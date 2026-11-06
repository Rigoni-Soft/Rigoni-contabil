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
const ROTULO_DO_ANEXO = { imagem: "Imagem", audio: "Áudio", documento: "Arquivo" } as const;

function previaDe(mensagem: AtendimentoVisto["ultimaMensagem"]): string | null {
  if (!mensagem) return null;
  // Mídia: o tipo no lugar do texto; a legenda, se houver, segue depois.
  const legenda = mensagem.texto.replace(/\s+/g, " ").trim();
  const texto = mensagem.anexoTipo
    ? [ROTULO_DO_ANEXO[mensagem.anexoTipo], legenda].filter(Boolean).join(": ")
    : legenda;
  // Por ponto de código: cortar em UTF-16 partiria o par substituto de um emoji.
  const letras = [...texto];
  const curto =
    letras.length > PREVIA_TAMANHO ? `${letras.slice(0, PREVIA_TAMANHO - 1).join("")}…` : texto;
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
