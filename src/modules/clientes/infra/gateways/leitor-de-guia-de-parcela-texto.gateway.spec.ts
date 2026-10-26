import { LeitorDeGuiaDeParcelaTextoGateway } from "./leitor-de-guia-de-parcela-texto.gateway";

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

// Texto sintético no formato que a extração devolve do DAS do SENDA (espaços normalizados, dados
// inventados): nenhum PDF real vai para o repositório.
const DAS = (observacoes = "PGFN-SISPAR:150141670") =>
  "Documento de Arrecadação do Simples Nacional CNPJ 10.690.529/0001-38 Razão Social EMPRESA TESTE LTDA " +
  "Período de Apuração 10/2026 Data de Vencimento 30/11/2026 Número do Documento 07.20.26302.1234567-8 " +
  "Valor Total do Documento R$ 1.262,89 Composição 1001 IRPJ 10,00 Observações " +
  observacoes +
  " Pague com PIX";

const ler = (texto: string | Error) =>
  new LeitorDeGuiaDeParcelaTextoGateway(async () => {
    if (texto instanceof Error) throw texto;
    return texto;
  }).ler(PDF);

describe("LeitorDeGuiaDeParcelaTextoGateway", () => {
  it("DAS do SENDA: CNPJ, conta, competência, vencimento e valor lidos", async () => {
    expect(await ler(DAS())).toEqual({
      lido: true,
      cnpj: "10.690.529/0001-38",
      contaNegociacao: "150141670",
      competencia: "202610",
      vencimento: "2026-11-30",
      valorCentavos: 126289,
    });
  });

  it("DAS sem a observação PGFN-SISPAR (não é de parcelamento PGFN) não é lido", async () => {
    expect(await ler(DAS("Pagamento em dia"))).toEqual({ lido: false });
  });

  it("sem Período de Apuração, a competência vem nula", async () => {
    const texto = DAS().replace("Período de Apuração 10/2026", "");
    expect(await ler(texto)).toMatchObject({ lido: true, competencia: null });
  });

  it("modelo desconhecido, texto vazio (escaneado) e falha ao extrair não são lidos", async () => {
    const recibo = "RECIBO DE ADESÃO AO PARCELAMENTO DO SIMPLES NACIONAL CNPJ: 11.444.777/0001-61";
    expect(await ler(recibo)).toEqual({ lido: false });
    expect(await ler("")).toEqual({ lido: false });
    expect(await ler(new Error("pdf corrompido"))).toEqual({ lido: false });
  });
});
