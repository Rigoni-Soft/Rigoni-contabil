import { useCallback, useId, useRef, useState } from "react";
import { useIsMutating } from "@tanstack/react-query";

import type { ConversaVista } from "@/modules/atendimento/application/ports/in/obter-conversa.provider";
import {
  conversaKeys,
  useMensagensAnterioresMutation,
  useReagirAMensagemMutation,
} from "@/modules/atendimento/presentation/view-models/conversa/conversa.queries";
import { useAnexoPendente } from "@/modules/atendimento/presentation/view-models/conversa/use-anexo-pendente.hook";
import { useArrastarArquivo } from "@/modules/atendimento/presentation/view-models/conversa/use-arrastar-arquivo.hook";
import { useConversa } from "@/modules/atendimento/presentation/view-models/conversa/use-conversa.hook";
import { useEmojisRecentes } from "@/modules/atendimento/presentation/view-models/conversa/use-emojis-recentes.hook";
import { useFechaSeletor } from "@/modules/atendimento/presentation/view-models/conversa/use-fecha-seletor.hook";

const PAINEL_ALTURA_PX = 272;
const PAINEL_LARGURA_PX = 288;
const FOLGA_DA_JANELA_PX = 8;
const DISTANCIA_DO_BOTAO_PX = 4;

function posicaoDoPainel(botao: DOMRect): React.CSSProperties {
  const left = Math.max(
    FOLGA_DA_JANELA_PX,
    Math.min(botao.left, window.innerWidth - PAINEL_LARGURA_PX - FOLGA_DA_JANELA_PX),
  );
  const cabeAbaixoDoBotao = window.innerHeight - botao.bottom >= PAINEL_ALTURA_PX;
  return cabeAbaixoDoBotao
    ? { left, top: botao.bottom + DISTANCIA_DO_BOTAO_PX }
    : { left, bottom: window.innerHeight - botao.top + DISTANCIA_DO_BOTAO_PX };
}

export function useMensagensConversa(atendimentoId: string, initialData: ConversaVista) {
  const { conversa, transferido } = useConversa(atendimentoId, initialData);
  const reagir = useReagirAMensagemMutation(atendimentoId);
  const anteriores = useMensagensAnterioresMutation(atendimentoId);
  const pendente = useAnexoPendente(atendimentoId);
  const enviandoAnexo = useIsMutating({ mutationKey: conversaKeys.enviarAnexo(atendimentoId) }) > 0;
  const [aberta, setAberta] = useState<{ id: string; estilo: React.CSSProperties } | null>(null);
  const [completo, setCompleto] = useState(false);
  const { recentes, recarregar, registrar } = useEmojisRecentes();
  const raiz = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const painelId = useId();
  const fechar = useCallback(() => setAberta(null), []);
  useFechaSeletor(aberta !== null, raiz, botao, fechar);

  const conversaDoUsuario = !conversa.encerrado && !transferido;
  const arraste = useArrastarArquivo(
    conversaDoUsuario && !enviandoAnexo ? (arquivo: File) => pendente.anexar(arquivo) : undefined,
  );

  return {
    mensagens: conversa.mensagens,
    anteriores: {
      disponivel: conversa.temMaisAnteriores,
      carregando: anteriores.isPending,
      erro: anteriores.isError ? anteriores.error.message : undefined,
      aoCarregar: () => anteriores.mutate(),
    },
    arraste,
    reacao: {
      ativa: conversaDoUsuario,
      abertaId: aberta?.id ?? null,
      estilo: aberta?.estilo,
      completo,
      recentes,
      painelId,
      raizRef: raiz,
      botaoRef: botao,
      erro: reagir.isError ? reagir.error.message : undefined,
      aoAlternar: (mensagemId: string, botaoRect: DOMRect) => {
        if (aberta?.id === mensagemId) return setAberta(null);
        recarregar();
        setCompleto(false);
        setAberta({ id: mensagemId, estilo: posicaoDoPainel(botaoRect) });
      },
      aoExpandir: () => setCompleto(true),
      aoEscolher: (mensagemId: string, emoji: string) => {
        setAberta(null);
        registrar(emoji);
        reagir.mutate({ mensagemId, emoji });
      },
    },
  };
}
