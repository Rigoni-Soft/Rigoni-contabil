import { LeitorDeParcelamentoFalsoGateway } from "./leitor-de-parcelamento-falso.gateway";

const pdfCom = (marcador = "") => new Uint8Array(Buffer.from(`%PDF-1.4 ${marcador}`));
const ler = (marcador?: string) => new LeitorDeParcelamentoFalsoGateway().ler(pdfCom(marcador));

describe("LeitorDeParcelamentoFalsoGateway", () => {
  it("sem marcador: sempre o mesmo código, quantidade e dados do acordo, sem CNPJ", async () => {
    const esperado = {
      lido: true,
      codigo: "FALSO-123456",
      quantidadeDeParcelas: 12,
      cnpj: null,
      origem: "pgfn",
      totalDeParcelas: 12,
      valorDaParcelaCentavos: 31620,
      dataDeAdesao: "2026-08-27",
    };

    expect(await ler()).toEqual(esperado);
    expect(await ler()).toEqual(esperado);
  });

  it("[leitor:falha]: não lê", async () => {
    expect(await ler("[leitor:falha]")).toEqual({ lido: false, motivo: "ilegivel" });
  });

  it("[leitor:sem-codigo]: lê só a quantidade, como o recibo da Receita", async () => {
    expect(await ler("[leitor:sem-codigo]")).toMatchObject({
      lido: true,
      codigo: null,
      quantidadeDeParcelas: 7,
      origem: "receita_federal",
    });
  });

  it("[leitor:cnpj-outro]: lê o CNPJ de outra empresa", async () => {
    expect(await ler("[leitor:cnpj-outro]")).toMatchObject({
      lido: true,
      cnpj: "10.690.529/0001-38",
    });
  });
});
