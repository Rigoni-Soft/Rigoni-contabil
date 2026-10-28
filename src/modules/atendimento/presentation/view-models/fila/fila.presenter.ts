import { formatarCnpj } from "@/presentation/lib/cnpj-mask";
import { telefoneParaExibicao } from "@/presentation/lib/telefone-mask";
import type { ItemDaFilaVisto } from "@/modules/atendimento/application/ports/in/listar-fila.provider";
import { formatarEspera } from "@/shared/kernel/espera";
import { SETOR_LABEL, type SetorSlug } from "@/shared/kernel/setores";

export type ItemDaFilaView = {
  id: string;
  contato: string;
  empresa: string;
  cnpj: string | null;
  telefone: string;
  resumo: string | null;
  // Dirigido a um usuário (não à espera do Setor): só ele assume.
  dirigido: boolean;
  espera: string;
  // Espera do Setor: qualquer um assume. Dirigida: só o destinatário (Líder e Admin só leem).
  assumivel: boolean;
};

// `agora` em ms: o cronômetro da tela recalcula `espera` a cada segundo com o relógio do navegador.
export function itemDaFilaParaView(
  item: ItemDaFilaVisto,
  agora?: number,
  usuarioId?: string,
): ItemDaFilaView {
  const filaDesdeMs = new Date(item.filaDesde).getTime();
  return {
    id: item.atendimentoId,
    contato: item.contato.contatoNome ?? "Contato não identificado",
    empresa: item.contato.empresa ?? "Cliente não identificado",
    cnpj: item.contato.cnpj ? formatarCnpj(item.contato.cnpj) : null,
    telefone: telefoneParaExibicao(item.telefone),
    resumo: item.resumo,
    dirigido: item.filaDoFuncionarioId !== null,
    espera: agora === undefined ? item.espera : formatarEspera(agora - filaDesdeMs),
    assumivel: item.filaDoFuncionarioId === null || item.filaDoFuncionarioId === usuarioId,
  };
}

export function tituloDaFila(nome: string, setor: SetorSlug): string {
  return `Fila de atendimento do ${nome}, setor ${SETOR_LABEL[setor]}`;
}

// O cartão do dock fora da conversa e da tela da Fila (mesmo formato do de Atendimentos).
export type AvisoDaFilaView = {
  id: string;
  href: string;
  titulo: string;
  detalhe: string;
  previa: string;
  aguardando: boolean;
  sinal: string;
};

export function avisoDaFila(itens: ItemDaFilaVisto[]): AvisoDaFilaView | null {
  if (itens.length === 0) return null;
  return {
    id: "fila",
    href: "/fila",
    titulo: "Fila de atendimento",
    detalhe: itens.length === 1 ? "1 cliente aguardando" : `${itens.length} clientes aguardando`,
    previa: `Mais antigo: ${itemDaFilaParaView(itens[0]).contato}`,
    aguardando: true,
    // Muda quando a Fila muda: o cartão é recriado e a animação de entrada roda de novo.
    sinal: itens.map((i) => i.atendimentoId).join(","),
  };
}
