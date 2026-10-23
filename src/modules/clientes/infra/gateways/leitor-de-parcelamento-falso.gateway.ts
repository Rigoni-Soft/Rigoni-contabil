import type {
  LeitorDeParcelamentoPort,
  LeituraDeParcelamento,
} from "@/modules/clientes/application/ports/out/leitor-de-parcelamento.provider";

// Adapter falso e determinístico (padrão em dev, CI e Preview; nenhum teste chama a API). Os
// marcadores no texto do PDF escolhem o cenário: `[leitor:falha]` não lê, `[leitor:sem-codigo]` lê
// só a quantidade (como o Recibo de Adesão); sem marcador, lê sempre o mesmo código e quantidade.
export class LeitorDeParcelamentoFalsoGateway implements LeitorDeParcelamentoPort {
  async ler(pdf: Uint8Array): Promise<LeituraDeParcelamento> {
    const texto = Buffer.from(pdf).toString("latin1");
    if (texto.includes("[leitor:falha]")) return { lido: false, motivo: "ilegivel" };
    if (texto.includes("[leitor:sem-codigo]")) {
      return { lido: true, codigo: null, quantidadeDeParcelas: 7 };
    }
    return { lido: true, codigo: "FALSO-123456", quantidadeDeParcelas: 12 };
  }
}
