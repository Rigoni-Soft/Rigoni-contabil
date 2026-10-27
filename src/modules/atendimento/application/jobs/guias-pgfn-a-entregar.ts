import type { GuiaFiscal } from "@/modules/atendimento/application/ports/out/guias-fiscais.provider";
import type {
  GuiaPgfnConfirmada,
  ParcelamentoPgfn,
} from "@/modules/atendimento/application/ports/out/guias-pgfn.provider";

export type GuiaPgfnAEntregar = GuiaPgfnConfirmada & { parcelamento: ParcelamentoPgfn };

// A guia como as portas de entrega a conhecem: o PDF vem do banco, sem valor (a identidade do
// registro é só a competência).
export const guiaPgfn = (codigo: string, competencia: string, pdfBase64: string): GuiaFiscal => ({
  nomeArquivo: `parcelamento-${codigo}-${competencia}.pdf`,
  pdfBase64,
  parcela: competencia,
});

// As guias confirmadas e ainda sem registro de envio, até a competência do mês corrente (AAAAMM),
// da mais antiga para a mais nova. Guia futura fica guardada; guia não confirmada nem entra na lista.
// `reenviarDoMes` (URA): o parcelamento sem nenhuma pendente devolve a guia do mês já enviada, para
// o pedido repetido reenviar o mesmo PDF.
export function guiasPgfnAEntregar(
  parcelamentos: ParcelamentoPgfn[],
  mes: string,
  reenviarDoMes = false,
): GuiaPgfnAEntregar[] {
  return parcelamentos
    .flatMap((parcelamento) => {
      const pendentes = parcelamento.guias.filter(
        (g) => g.competencia <= mes && !parcelamento.parcelasEnviadas.includes(g.competencia),
      );
      const doMes = parcelamento.guias.filter((g) => g.competencia === mes);
      const aEntregar = pendentes.length === 0 && reenviarDoMes ? doMes : pendentes;
      return aEntregar.map((g) => ({ ...g, parcelamento }));
    })
    .sort((a, b) => a.competencia.localeCompare(b.competencia));
}
