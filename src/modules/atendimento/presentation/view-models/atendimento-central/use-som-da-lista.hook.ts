import { useEffect, useRef } from "react";

import { prepararSom, tocarNotificacao } from "@/presentation/lib/notificacao-sonora";
import type { AtendimentoEmAndamentoView } from "@/modules/atendimento/presentation/view-models/meus-atendimentos/meus-atendimentos.presenter";

type Conversa = Pick<AtendimentoEmAndamentoView, "id" | "aguardando" | "sinal">;

// O aviso sonoro da tela Atendimento (o que o Dock fazia): toca quando surge um Atendimento na
// espera ou o cliente escreve de novo numa conversa que não está aberta. A primeira leitura de cada
// lista é silenciosa. Dois sons na mesma leitura viram um só.
export function useSomDaLista(
  idsDaEspera: string[],
  emAtendimento: Conversa[],
  abertoId: string | null,
) {
  const esperaAnterior = useRef<Set<string> | null>(null);
  const conversasAnterior = useRef<Map<string, string> | null>(null);

  useEffect(() => prepararSom(), []);

  const chaveDaEspera = idsDaEspera.join(",");
  const chaveDasConversas = JSON.stringify(
    emAtendimento.map((c) => [c.id, c.aguardando ? c.sinal : ""]),
  );
  useEffect(() => {
    const espera = new Set(idsDaEspera);
    const conversas = new Map(
      emAtendimento.filter((c) => c.aguardando).map((c) => [c.id, c.sinal] as const),
    );
    const esperaAntes = esperaAnterior.current;
    const conversasAntes = conversasAnterior.current;
    esperaAnterior.current = espera;
    conversasAnterior.current = conversas;

    const chegouNaEspera = esperaAntes !== null && [...espera].some((id) => !esperaAntes.has(id));
    const clienteEscreveu =
      conversasAntes !== null &&
      [...conversas].some(([id, sinal]) => id !== abertoId && conversasAntes.get(id) !== sinal);
    if (chegouNaEspera || clienteEscreveu) tocarNotificacao();
    // As listas entram pelas chaves: um array novo com o mesmo conteúdo não é leitura nova.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveDaEspera, chaveDasConversas, abertoId]);
}
