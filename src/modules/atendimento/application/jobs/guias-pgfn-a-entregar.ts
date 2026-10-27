import type {
  GuiaPgfnConfirmada,
  ParcelamentoPgfn,
} from "@/modules/atendimento/application/ports/out/guias-pgfn.provider";

export type GuiaPgfnAEntregar = GuiaPgfnConfirmada & { parcelamento: ParcelamentoPgfn };

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
