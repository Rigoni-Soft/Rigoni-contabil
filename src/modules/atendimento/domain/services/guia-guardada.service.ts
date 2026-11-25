export type ChaveGuia = { id: string; periodo: string };

const aaaamm = (mesOuData: string): string => mesOuData.slice(0, 7).replace("-", "");

export const chaveDoDas = (mesOuData: string): ChaveGuia => ({
  id: "das",
  periodo: aaaamm(mesOuData),
});

export const chaveDoParcelamento = (parcelamentoId: string, parcela: string): ChaveGuia => ({
  id: parcelamentoId,
  periodo: parcela,
});
