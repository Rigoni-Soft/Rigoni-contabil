import type {
  LeitorDeParcelamentoPort,
  LeituraDeParcelamento,
} from "@/modules/clientes/application/ports/out/leitor-de-parcelamento.provider";

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
