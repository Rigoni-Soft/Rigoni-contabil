import { useEffect, useRef, useState } from "react";

import type { ItemDaFilaVisto } from "@/modules/atendimento/application/ports/in/listar-fila.provider";
import type { AtendimentoVisto } from "@/modules/atendimento/application/ports/in/listar-meus-atendimentos.provider";
import { useAtendimentoCentralStore } from "@/modules/atendimento/presentation/view-models/atendimento-central/atendimento-central.store";
import { useAssumirAtendimentoMutation } from "@/modules/atendimento/presentation/view-models/fila/assumir.queries";
import { useFila } from "@/modules/atendimento/presentation/view-models/fila/use-fila.hook";
import { atendimentoParaView } from "@/modules/atendimento/presentation/view-models/meus-atendimentos/meus-atendimentos.presenter";
import { useMeusAtendimentosQuery } from "@/modules/atendimento/presentation/view-models/meus-atendimentos/meus-atendimentos.queries";
import type { SetorSlug } from "@/shared/kernel/setores";

const AVISO_DE_ASSUNCAO_MS = 8_000;

type Entrada = {
  usuarioId: string;
  setorInicial: SetorSlug;
  filaInicial: ItemDaFilaVisto[];
  meusInicial: AtendimentoVisto[];
  podeEscolherSetor: boolean;
};

// A região da lista: a espera do Setor, os Atendimentos do usuário e o assumir. Aba e conversa
// aberta ficam no store da tela, porque o chat e as ações também dependem delas.
export function useAtendimentoCentral({
  usuarioId,
  setorInicial,
  filaInicial,
  meusInicial,
  podeEscolherSetor,
}: Entrada) {
  const fila = useFila(setorInicial, filaInicial, podeEscolherSetor, usuarioId);
  const meus = useMeusAtendimentosQuery(true, meusInicial);
  const assumir = useAssumirAtendimentoMutation();
  const { aba, abertoId, escolherAba, abrir, aoAssumir } = useAtendimentoCentralStore();
  const { isError, reset } = assumir;
  const [anuncio, setAnuncio] = useState("");
  // Ids da espera na leitura anterior; null = ainda não houve leitura (a primeira é silenciosa).
  const esperaAnterior = useRef<Set<string> | null>(null);
  const idsDaEspera = fila.itens.map((item) => item.id).join(",");

  // Cliente novo na espera: o som avisa quem ouve; o texto avisa o leitor de tela (WCAG 4.1.3). Só
  // entradas contam; quem sai (assumido por outro) não é novidade.
  useEffect(() => {
    const atuais = new Set(idsDaEspera ? idsDaEspera.split(",") : []);
    const antes = esperaAnterior.current;
    esperaAnterior.current = atuais;
    if (!antes) return;
    const novos = [...atuais].filter((id) => !antes.has(id)).length;
    if (novos === 0) return;
    const quem = novos === 1 ? "Novo cliente" : `${novos} novos clientes`;
    setAnuncio(`${quem} em espera. Total na espera: ${atuais.size}.`);
  }, [idsDaEspera]);

  // "Já assumido" informa uma tentativa, não um estado da tela: some sozinho, e ao trocar de aba.
  useEffect(() => {
    if (!isError) return;
    const timer = setTimeout(reset, AVISO_DE_ASSUNCAO_MS);
    return () => clearTimeout(timer);
  }, [isError, reset]);

  return {
    ...fila,
    aba,
    escolherAba: (nova: typeof aba) => {
      reset();
      escolherAba(nova);
    },
    espera: fila.itens,
    anuncio,
    emAtendimento: (meus.data ?? []).map(atendimentoParaView),
    abertoId,
    abrir,
    assumir: (atendimentoId: string) =>
      assumir.mutate(atendimentoId, { onSuccess: () => aoAssumir(atendimentoId) }),
    assumindo: assumir.isPending,
    avisoDeAssuncao: assumir.isError ? assumir.error.message : undefined,
  };
}
