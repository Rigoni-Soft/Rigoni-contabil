import { formatarCnpj } from "@/presentation/lib/cnpj-mask";
import type { ItemDaFilaVisto } from "@/modules/atendimento/application/ports/in/listar-fila.provider";
import { telefoneParaExibicao } from "@/modules/atendimento/presentation/view-models/conversa/conversa.presenter";
import { formatarEspera } from "@/shared/kernel/espera";
import { SETOR_LABEL } from "@/shared/kernel/setores";

export type ItemDaFilaView = {
  id: string;
  posicao: number;
  contato: string;
  empresa: string;
  cnpj: string | null;
  telefone: string;
  resumo: string | null;
  // Fila de um usuário (não a do Setor): o item só sai quando ele ficar livre.
  daFilaDeUsuario: boolean;
  espera: string;
};

// `agora` em ms: o cronômetro da tela recalcula `espera` a cada segundo com o relógio do navegador.
export function itemDaFilaParaView(item: ItemDaFilaVisto, agora?: number): ItemDaFilaView {
  const filaDesdeMs = new Date(item.filaDesde).getTime();
  return {
    id: item.atendimentoId,
    posicao: item.posicao,
    contato: item.contato.contatoNome ?? "Contato não identificado",
    empresa: item.contato.empresa ?? "Cliente não identificado",
    cnpj: item.contato.cnpj ? formatarCnpj(item.contato.cnpj) : null,
    telefone: telefoneParaExibicao(item.telefone),
    resumo: item.resumo,
    daFilaDeUsuario: item.filaDoFuncionarioId !== null,
    espera: agora === undefined ? item.espera : formatarEspera(agora - filaDesdeMs),
  };
}

export function tituloDaFila(nome: string, setor: string): string {
  return `Fila de atendimento do ${nome}, setor ${SETOR_LABEL[setor] ?? setor}`;
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
    previa: `Próximo: ${itemDaFilaParaView(itens[0]).contato}`,
    aguardando: true,
    // Muda quando a Fila muda: o cartão é recriado e a animação de entrada roda de novo.
    sinal: itens.map((i) => i.atendimentoId).join(","),
  };
}
