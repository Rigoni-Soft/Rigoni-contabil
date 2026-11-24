import { useEffect, useRef, useState } from "react";

import type { AtendimentoEmAndamentoView } from "@/modules/atendimento/presentation/view-models/meus-atendimentos/meus-atendimentos.presenter";

const ESPACO_SEM_QUEBRA = String.fromCharCode(0x00a0);

type Espera = { id: string };
type Conversa = Pick<AtendimentoEmAndamentoView, "id" | "titulo" | "aguardando" | "sinal">;

export function useAnuncioDaLista(
  espera: Espera[],
  emAtendimento: Conversa[],
  abertoId: string | null,
) {
  const [anuncio, setAnuncio] = useState("");
  const vezes = useRef(0);
  const esperaAnterior = useRef<Set<string> | null>(null);
  const conversasAnterior = useRef<Map<string, string> | null>(null);

  const anunciar = (texto: string) => {
    vezes.current += 1;
    setAnuncio(vezes.current % 2 === 0 ? `${texto}${ESPACO_SEM_QUEBRA}` : texto);
  };

  const idsDaEspera = espera.map((item) => item.id).join(",");
  useEffect(() => {
    const atuais = new Set(idsDaEspera ? idsDaEspera.split(",") : []);
    const antes = esperaAnterior.current;
    esperaAnterior.current = atuais;
    if (!antes) return;
    const novos = [...atuais].filter((id) => !antes.has(id)).length;
    if (novos === 0) return;
    const quem = novos === 1 ? "Novo cliente" : `${novos} novos clientes`;
    anunciar(`${quem} em espera. Total na espera: ${atuais.size}.`);
  }, [idsDaEspera]);

  const sinaisDasConversas = JSON.stringify(
    emAtendimento.map((c) => [c.id, c.aguardando ? c.sinal : "", c.titulo]),
  );
  useEffect(() => {
    const atuais = new Map(
      emAtendimento.filter((c) => c.aguardando).map((c) => [c.id, c.sinal] as const),
    );
    const antes = conversasAnterior.current;
    conversasAnterior.current = atuais;
    if (!antes) return;
    const escreveram = emAtendimento.filter(
      (c) => c.aguardando && c.id !== abertoId && antes.get(c.id) !== c.sinal,
    );
    if (escreveram.length === 0) return;
    anunciar(
      escreveram.length === 1
        ? `${escreveram[0].titulo} escreveu.`
        : `${escreveram.length} clientes escreveram.`,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sinaisDasConversas, abertoId]);

  return anuncio;
}
