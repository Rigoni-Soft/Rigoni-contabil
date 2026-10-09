import { telefoneParaExibicao } from "@/presentation/lib/telefone-mask";
import type { AtendimentoVisto } from "@/modules/atendimento/application/ports/in/listar-meus-atendimentos.provider";

export type AtendimentoEmAndamentoView = {
  id: string;
  href: string;
  titulo: string;
  detalhe: string;
  // Início da última mensagem, quem a escreveu e se o cliente está esperando resposta.
  previa: string | null;
  aguardando: boolean;
  // Muda quando chega mensagem nova: o hook compara para tocar o aviso e a animação recomeçar.
  sinal: string;
};

const PREVIA_TAMANHO = 60;
const AUTOR_DA_PREVIA = { contato: "", funcionario: "Você: ", ura: "URA: " } as const;

function previaDe(mensagem: AtendimentoVisto["ultimaMensagem"]): string | null {
  if (!mensagem) return null;
  const texto = mensagem.texto.replace(/\s+/g, " ").trim();
  const curto = texto.length > PREVIA_TAMANHO ? `${texto.slice(0, PREVIA_TAMANHO - 1)}…` : texto;
  return `${AUTOR_DA_PREVIA[mensagem.autor]}${curto}`;
}

export function atendimentoParaView(a: AtendimentoVisto): AtendimentoEmAndamentoView {
  return {
    id: a.atendimentoId,
    href: `/atendimento/${a.atendimentoId}`,
    titulo: a.contato.contatoNome ?? telefoneParaExibicao(a.telefone),
    detalhe: a.contato.empresa ?? "Cliente não identificado",
    previa: previaDe(a.ultimaMensagem),
    aguardando: a.ultimaMensagem?.autor === "contato",
    sinal: a.ultimaMensagem?.criadoEm ?? "",
  };
}
