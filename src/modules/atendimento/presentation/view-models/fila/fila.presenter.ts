import { formatarCnpj } from "@/presentation/lib/cnpj-mask";
import { telefoneParaExibicao } from "@/presentation/lib/telefone-mask";
import type { ItemDaFilaVisto } from "@/modules/atendimento/application/ports/in/listar-fila.provider";
import { formatarEspera } from "@/shared/kernel/espera";
import { SETOR_LABEL, SETORES } from "@/shared/kernel/setores";

export type ItemDaFilaView = {
  id: string;
  contato: string;
  empresa: string;
  cnpj: string | null;
  telefone: string;
  resumo: string | null;
  // "Transferido de Financeiro por Fulano"; null se o Atendimento não veio de Transferência.
  origem: string | null;
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
    origem: item.origem && textoDaOrigem(item.origem),
    dirigido: item.filaDoFuncionarioId !== null,
    espera: agora === undefined ? item.espera : formatarEspera(agora - filaDesdeMs),
    assumivel:
      item.filaDoFuncionarioId === null ? item.esperaComum : item.filaDoFuncionarioId === usuarioId,
  };
}

function textoDaOrigem({ setor, nome }: NonNullable<ItemDaFilaVisto["origem"]>): string {
  return `Transferido de ${SETOR_LABEL[setor]}${nome ? ` por ${nome}` : ""}`;
}

// As opções do seletor de Setor (só o Admin escolhe) da Fila e da tela Atendimento.
export const OPCOES_DE_SETOR = SETORES.map((valor) => ({ valor, rotulo: SETOR_LABEL[valor] }));
