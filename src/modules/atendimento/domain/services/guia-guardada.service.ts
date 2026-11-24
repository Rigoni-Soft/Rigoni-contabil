export type ChaveGuia = { id: string; periodo: string };

export const chaveDoDas = (mesOuData: string): ChaveGuia => ({
  id: "das",
  periodo: mesOuData.slice(0, 7).replace("-", ""),
});

export const chaveDoParcelamento = (parcelamentoId: string, parcela: string): ChaveGuia => ({
  id: parcelamentoId,
  periodo: parcela,
});
