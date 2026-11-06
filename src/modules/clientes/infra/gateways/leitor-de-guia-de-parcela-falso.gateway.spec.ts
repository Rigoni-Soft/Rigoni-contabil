import { LeitorDeGuiaDeParcelaFalsoGateway } from "./leitor-de-guia-de-parcela-falso.gateway";

const ler = (texto: string) =>
  new LeitorDeGuiaDeParcelaFalsoGateway().ler(Buffer.from(texto, "latin1"));

describe("LeitorDeGuiaDeParcelaFalsoGateway", () => {
  it("sem marcador, lê sem nada conferível (a guia fica a confirmar)", async () => {
    expect(await ler("guia comum")).toEqual({
      lido: true,
      cnpj: null,
      contaNegociacao: null,
      competencia: null,
      vencimento: null,
      valorCentavos: null,
    });
  });

  it("[leitor:falha] não lê", async () => {
    expect(await ler("[leitor:falha]")).toEqual({ lido: false });
  });

  it("[leitor:cnpj-outro] lê o CNPJ de outra empresa", async () => {
    expect(await ler("[leitor:cnpj-outro]")).toMatchObject({
      lido: true,
      cnpj: "10.690.529/0001-38",
    });
  });

  it("[leitor:guia=cnpj;conta;competência] lê o que o marcador informa", async () => {
    expect(await ler("[leitor:guia=11.444.777/0001-61;150141670;202610]")).toMatchObject({
      lido: true,
      cnpj: "11.444.777/0001-61",
      contaNegociacao: "150141670",
      competencia: "202610",
    });
  });
});
