import type { AtendimentoVisto } from "@/modules/atendimento/application/ports/in/listar-meus-atendimentos.provider";
import { telefoneParaExibicao } from "@/modules/atendimento/presentation/view-models/conversa/conversa.presenter";

export type AtendimentoEmAndamentoView = {
  id: string;
  href: string;
  titulo: string;
  detalhe: string;
};

export function atendimentoParaView(a: AtendimentoVisto): AtendimentoEmAndamentoView {
  return {
    id: a.atendimentoId,
    href: `/atendimento/${a.atendimentoId}`,
    titulo: a.contato.contatoNome ?? telefoneParaExibicao(a.telefone),
    detalhe: a.contato.empresa ?? "Cliente não identificado",
  };
}
