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
export function guiasPgfnAEntregar(
  parcelamentos: ParcelamentoPgfn[],
  mes: string,
): GuiaPgfnAEntregar[] {
  return parcelamentos
    .flatMap((parcelamento) =>
      parcelamento.guias
        .filter(
          (g) => g.competencia <= mes && !parcelamento.parcelasEnviadas.includes(g.competencia),
        )
        .map((g) => ({ ...g, parcelamento })),
    )
    .sort((a, b) => a.competencia.localeCompare(b.competencia));
}

// URA, sem nenhuma pendente: a guia mais recente já entregue, para o pedido repetido reenviar o PDF
// registrado nela (nunca o anexo, que pode ter sido trocado), qualquer que seja a competência.
export function guiaPgfnAReenviar(parcelamento: ParcelamentoPgfn) {
  return [...parcelamento.entregues].sort((a, b) => b.competencia.localeCompare(a.competencia))[0];
}
