import { useEffect, useRef, useState } from "react";

import type { AtendimentoEmAndamentoView } from "@/modules/atendimento/presentation/view-models/meus-atendimentos/meus-atendimentos.presenter";

// Espaço sem quebra: não é lido, mas muda o texto da região para o leitor de tela reanunciar.
const ESPACO_INVISIVEL = String.fromCharCode(0x00a0);

type Espera = { id: string };
type Conversa = Pick<AtendimentoEmAndamentoView, "id" | "titulo" | "aguardando" | "sinal">;

// O som avisa quem ouve; este texto avisa o leitor de tela (WCAG 4.1.3), numa região `status`. Dois
// avisos: cliente novo na espera, e cliente que escreve de novo numa conversa que não está aberta.
// A primeira leitura de cada lista é silenciosa, e quem sai da espera (assumido por outro) não conta.
export function useAnuncioDaLista(
  espera: Espera[],
  emAtendimento: Conversa[],
  abertoId: string | null,
) {
  const [anuncio, setAnuncio] = useState("");
  const vezes = useRef(0);
  const esperaAnterior = useRef<Set<string> | null>(null);
  const conversasAnterior = useRef<Map<string, string> | null>(null);

  // Um leitor de tela só reanuncia quando o texto muda: um aviso igual ao anterior (ex.: um cliente
  // sai e outro entra, mesmo total) ganha um espaço invisível no fim, alternando a cada aviso.
  const anunciar = (texto: string) => {
    vezes.current += 1;
    setAnuncio(vezes.current % 2 === 0 ? `${texto}${ESPACO_INVISIVEL}` : texto);
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
    // `anunciar` só mexe em refs e no setter: fora das dependências de propósito.
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
    // Escreveu de novo: aguardando agora e sem estar na leitura anterior, ou com outro sinal (nova
    // mensagem). A conversa que o usuário está lendo já está na tela dele.
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
