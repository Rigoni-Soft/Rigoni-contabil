import { formatarCnpj } from "@/presentation/lib/cnpj-mask";
import type { ItemDaFilaVisto } from "@/modules/atendimento/application/ports/in/listar-fila.provider";
import { telefoneParaExibicao } from "@/modules/atendimento/presentation/view-models/conversa/conversa.presenter";
import { formatarEspera } from "@/shared/kernel/espera";

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
  filaDesdeMs: number;
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
    filaDesdeMs,
    espera: agora === undefined ? item.espera : formatarEspera(agora - filaDesdeMs),
  };
}
