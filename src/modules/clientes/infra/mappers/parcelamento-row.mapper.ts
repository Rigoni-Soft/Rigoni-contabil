import type { ParcelamentoSalvo } from "@/modules/clientes/application/ports/out/cliente-parcelamento.repository";
import type { OrigemDoParcelamento } from "@/modules/clientes/domain/value-objects/parcelamento.vo";
import { mesAtual } from "@/shared/kernel/mes-atual";

export type ParcelamentoRow = {
  id: string;
  codigo: string;
  parcelas_restantes: number;
  interno: boolean;
  arquivo_caminho: string;
  situacao: "em_aberto" | "quitado";
  origem: OrigemDoParcelamento | null;
  total_parcelas: number | null;
  valor_parcela_centavos: number | null;
  data_adesao: string | null;
  cliente_parcelamento_envios: { parcela: string }[];
};

// Embed que traz o Parcelamento com as parcelas já enviadas (status do mês, bloqueio de remoção).
export const SELECT_PARCELAMENTO = "*, cliente_parcelamento_envios(parcela)";
export const EMBED_PARCELAMENTOS = `cliente_parcelamentos(${SELECT_PARCELAMENTO})`;

export function parcelamentoDoRow(linha: ParcelamentoRow): ParcelamentoSalvo {
  const parcelaDoMes = mesAtual().replace("-", "");
  return {
    id: linha.id,
    codigo: linha.codigo,
    parcelasRestantes: linha.parcelas_restantes,
    interno: linha.interno,
    arquivoCaminho: linha.arquivo_caminho,
    acordo: {
      origem: linha.origem,
      totalDeParcelas: linha.total_parcelas,
      valorDaParcelaCentavos: linha.valor_parcela_centavos,
      dataDeAdesao: linha.data_adesao,
    },
    quitado: linha.situacao === "quitado" || linha.parcelas_restantes === 0,
    temEnvio: linha.cliente_parcelamento_envios.length > 0,
    enviadoNoMes: linha.cliente_parcelamento_envios.some((e) => e.parcela === parcelaDoMes),
  };
}
