import type {
  LeitorDeParcelamentoPort,
  LeituraDeParcelamento,
} from "@/modules/clientes/application/ports/out/leitor-de-parcelamento.provider";

// Adapter falso e determinístico (padrão em dev, CI e Preview; nenhum teste chama a API). Os
// marcadores no texto do PDF escolhem o cenário: `[leitor:falha]` não lê, `[leitor:sem-codigo]` lê
// só a quantidade (como o Recibo de Adesão da Receita), `[leitor:cnpj-outro]` lê o CNPJ de outra
// empresa; sem marcador, lê sempre o mesmo código, quantidade e dados do acordo (sem CNPJ).
export class LeitorDeParcelamentoFalsoGateway implements LeitorDeParcelamentoPort {
  async ler(pdf: Uint8Array): Promise<LeituraDeParcelamento> {
    const texto = Buffer.from(pdf).toString("latin1");
    if (texto.includes("[leitor:falha]")) return { lido: false, motivo: "ilegivel" };
    const semCodigo = texto.includes("[leitor:sem-codigo]");
    return {
      lido: true,
      codigo: semCodigo ? null : "FALSO-123456",
      quantidadeDeParcelas: semCodigo ? 7 : 12,
      cnpj: texto.includes("[leitor:cnpj-outro]") ? "10.690.529/0001-38" : null,
      origem: semCodigo ? "receita_federal" : "pgfn",
      totalDeParcelas: semCodigo ? 7 : 12,
      valorDaParcelaCentavos: 31620,
      dataDeAdesao: "2026-08-27",
    };
  }
}
