import { formatarCnpj } from "@/presentation/lib/cnpj-mask";
import { telefoneParaExibicao } from "@/presentation/lib/telefone-mask";
import type { ItemDaFilaVisto } from "@/modules/atendimento/application/ports/in/listar-fila.provider";
import { formatarEspera } from "@/shared/kernel/espera";
import { opcoesDe } from "@/shared/kernel/opcoes";
import { SETOR_LABEL, SETORES } from "@/shared/kernel/setores";

export type ItemDaFilaView = {
  id: string;
  contato: string;
  empresa: string;
  cnpj: string | null;
  telefone: string;
  resumo: string | null;
  origem: string | null;
  dirigido: boolean;
  espera: string;
  assumivel: boolean;
};

export function itemDaFilaParaView(
  item: ItemDaFilaVisto,
  agora?: number,
  usuarioId?: string,
  podeAssumir = true,
): ItemDaFilaView {
  const filaDesdeMs = new Date(item.filaDesde).getTime();
  const dirigidoAUmUsuario = item.filaDoFuncionarioId !== null;
  const usuarioPodeAssumirEste = dirigidoAUmUsuario
    ? item.filaDoFuncionarioId === usuarioId
    : item.esperaComum;
  return {
    id: item.atendimentoId,
    contato: item.contato.contatoNome ?? "Contato não identificado",
    empresa: item.contato.empresa ?? "Cliente não identificado",
    cnpj: item.contato.cnpj ? formatarCnpj(item.contato.cnpj) : null,
    telefone: telefoneParaExibicao(item.telefone),
    resumo: item.resumo,
    origem: item.origem && textoDaOrigem(item.origem),
    dirigido: dirigidoAUmUsuario,
    espera: agora === undefined ? item.espera : formatarEspera(agora - filaDesdeMs),
    assumivel: podeAssumir && usuarioPodeAssumirEste,
  };
}

function textoDaOrigem({ setor, nome }: NonNullable<ItemDaFilaVisto["origem"]>): string {
  return `Transferido de ${SETOR_LABEL[setor]}${nome ? ` por ${nome}` : ""}`;
}

export const OPCOES_DE_SETOR = opcoesDe(SETORES, SETOR_LABEL);
