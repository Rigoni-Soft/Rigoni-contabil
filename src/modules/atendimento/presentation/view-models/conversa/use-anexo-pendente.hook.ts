import { useEffect } from "react";

import { gerarMiniatura } from "@/presentation/lib/miniatura-de-imagem";
import {
  ANEXO_PENDENTE_VAZIO,
  useConversaStore,
} from "@/modules/atendimento/presentation/view-models/conversa/conversa.store";
import { ANEXO_MINIATURA_LADO, validarAnexo } from "@/shared/kernel/anexo";

// O arquivo escolhido e ainda não enviado (estado do cliente, em `conversa.store.ts`). O servidor
// confere tipo e tamanho de novo; aqui só se antecipa a mensagem.
// `limparAoDesmontar`: quem envia o arquivo (o campo de resposta) solta a prévia e libera o blob ao
// sair da tela; as outras regiões só leem ou depositam.
export function useAnexoPendente(atendimentoId: string, { limparAoDesmontar = false } = {}) {
  const estado = useConversaStore((s) => s.anexosPendentes[atendimentoId] ?? ANEXO_PENDENTE_VAZIO);
  const trocarAnexoPendente = useConversaStore((s) => s.trocarAnexoPendente);
  const completarMiniatura = useConversaStore((s) => s.completarMiniatura);
  const limparAnexoPendente = useConversaStore((s) => s.limparAnexoPendente);

  useEffect(() => {
    if (!limparAoDesmontar) return;
    return () => limparAnexoPendente(atendimentoId);
  }, [limparAoDesmontar, limparAnexoPendente, atendimentoId]);

  return {
    arquivo: estado.arquivo,
    miniaturaUrl: estado.miniaturaUrl,
    miniatura: estado.miniatura,
    erro: estado.erro,
    anexar(arquivo: File) {
      const { tipo, erro } = validarAnexo(arquivo.type, arquivo.size);
      if (!tipo) return trocarAnexoPendente(atendimentoId, { ...ANEXO_PENDENTE_VAZIO, erro });
      trocarAnexoPendente(atendimentoId, {
        ...ANEXO_PENDENTE_VAZIO,
        arquivo,
        miniaturaUrl: tipo === "imagem" ? URL.createObjectURL(arquivo) : null,
      });
      if (tipo !== "imagem") return;
      void gerarMiniatura(arquivo, ANEXO_MINIATURA_LADO).then((miniatura) => {
        if (miniatura) completarMiniatura(atendimentoId, arquivo, miniatura);
      });
    },
    limpar: () => limparAnexoPendente(atendimentoId),
  };
}
