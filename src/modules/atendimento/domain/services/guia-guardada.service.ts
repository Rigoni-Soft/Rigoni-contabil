// Onde a guia fica guardada no Storage: cliente/id/AAAAMM. A chave é estável, então cada tentativa
// sobrescreve a anterior e o reenvio reencontra o PDF sem chamar o provedor fiscal.
export type ChaveGuia = { id: string; periodo: string };

// `mesOuData`: "AAAA-MM" ou "AAAA-MM-DD". O DAS é guardado pelo mês do envio.
export const chaveDoDas = (mesOuData: string): ChaveGuia => ({
  id: "das",
  periodo: mesOuData.slice(0, 7).replace("-", ""),
});

// `parcela`: AAAAMM da guia do parcelamento.
export const chaveDoParcelamento = (parcelamentoId: string, parcela: string): ChaveGuia => ({
  id: parcelamentoId,
  periodo: parcela,
});
