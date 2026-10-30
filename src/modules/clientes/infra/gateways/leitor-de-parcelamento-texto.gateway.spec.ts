import { LeitorDeParcelamentoTextoGateway } from "./leitor-de-parcelamento-texto.gateway";

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

// Textos sintéticos no formato que a extração devolve dos dois modelos reais (espaços normalizados,
// dados inventados): nenhum PDF real vai para o repositório.
const RECIBO_RECEITA = (extra = { demais: "Valor das demais parcelas: R$ 316,20 " }) =>
  "MINISTÉRIO DA FAZENDA Secretaria da Receita Federal do Brasil RECIBO DE ADESÃO AO PARCELAMENTO " +
  "DO SIMPLES NACIONAL Nome Empresarial: EMPRESA TESTE LTDA CNPJ: 11.444.777/0001-61 " +
  "Relação dos débitos parcelados Período de Apuração Vencimento 11/2025¹ 22/12/2025 R$ 1.218,41 " +
  "Valor total parcelado: R$ 2.213,40 Número de parcelas: 7 Valor da primeira parcela: R$ 316,20 " +
  extra.demais +
  "Prazo para pagamento da primeira parcela: 31/08/2026 Importante: A concessão do parcelamento " +
  "Confirmação recebida via Internet pelo Agente Receptor SERPRO em 27/08/2026 às 11:56:16 " +
  "(horário de Brasília). Recibo: ABC123 Certificação Digital: 00AA CPF: 000.000.000-00";

const RECIBO_PGFN = (pagamento = "ENTRADA 1x 100,00 BÁSICA 4x 262,89") =>
  "1 / 4 INFORMAÇÃO DA NEGOCIAÇÃO Número da conta de negociação: 15014167 " +
  "CNPJ : 10.690.529/0001-38 Nome : EMPRESA TESTE LTDA Negociação: 0086 - TRANSACAO POR ADESAO " +
  "Conforme as informações prestadas em 27/01/2026, o contribuinte acima indicado realizou, no " +
  "âmbito da PGFN, adesão à negociação DÍVIDAS NEGOCIADAS 9052500519139 10.690.529/0001-38 3623 " +
  "27/01/2026 289,40 525,63 RECIBO DE ADESÃO E CONSOLIDAÇÃO DE NEGOCIAÇÃO 3 / 4 " +
  "DEMONSTRATIVO DE PAGAMENTO DA ENTRADA E PRESTAÇÕES TIPO DE PAGAMENTO QUANTIDADE VALOR " +
  pagamento +
  " Todos os valores em Reais (R$) COMO EMITIR O DOCUMENTO DE ARRECADAÇÃO Regularize";

const ler = (texto: string | Error) =>
  new LeitorDeParcelamentoTextoGateway(async () => {
    if (texto instanceof Error) throw texto;
    return texto;
  }).ler(PDF);

describe("LeitorDeParcelamentoTextoGateway", () => {
  it("Recibo de Adesão da Receita (Simples): sem código, parcelas, valor e data lidos", async () => {
    expect(await ler(RECIBO_RECEITA())).toEqual({
      lido: true,
      codigo: null,
      quantidadeDeParcelas: 7,
      cnpj: "11.444.777/0001-61",
      origem: "receita_federal",
      totalDeParcelas: 7,
      valorDaParcelaCentavos: 31620,
      dataDeAdesao: "2026-08-27",
    });
  });

  it("Recibo da PGFN: o número da conta é o código e as parcelas somam entrada e prestações", async () => {
    expect(await ler(RECIBO_PGFN())).toEqual({
      lido: true,
      codigo: "15014167",
      quantidadeDeParcelas: 5,
      cnpj: "10.690.529/0001-38",
      origem: "pgfn",
      totalDeParcelas: 5,
      valorDaParcelaCentavos: 26289,
      dataDeAdesao: "2026-01-27",
    });
  });

  it("PGFN sem entrada: só as prestações, e o valor é o delas", async () => {
    expect(await ler(RECIBO_PGFN("BÁSICA 12x 1.050,40"))).toMatchObject({
      lido: true,
      quantidadeDeParcelas: 12,
      totalDeParcelas: 12,
      valorDaParcelaCentavos: 105040,
    });
  });

  it("PGFN só com entrada: o valor da parcela é o da entrada", async () => {
    expect(await ler(RECIBO_PGFN("ENTRADA 1x 100,00"))).toMatchObject({
      quantidadeDeParcelas: 1,
      valorDaParcelaCentavos: 10000,
    });
  });

  it("Receita com uma parcela só (sem 'demais parcelas'): usa o valor da primeira", async () => {
    expect(await ler(RECIBO_RECEITA({ demais: "" }))).toMatchObject({
      lido: true,
      valorDaParcelaCentavos: 31620,
    });
  });

  it("dado opcional ausente vira nulo, sem derrubar a leitura", async () => {
    const semData = RECIBO_PGFN().replace("Conforme as informações prestadas em 27/01/2026", "");

    expect(await ler(semData)).toMatchObject({
      lido: true,
      codigo: "15014167",
      dataDeAdesao: null,
    });
  });

  it.each([
    ["modelo desconhecido", "Extrato qualquer de um banco, sem nada do que procuramos."],
    ["PDF sem texto (escaneado)", "  "],
    [
      "modelo conhecido sem número de parcelas",
      RECIBO_RECEITA().replace("Número de parcelas: 7", ""),
    ],
    ["PGFN sem tabela de pagamento", RECIBO_PGFN("")],
  ])("%s: ilegível, a tela cai no 'digite à mão'", async (_nome, texto) => {
    expect(await ler(texto)).toEqual({ lido: false, motivo: "ilegivel" });
  });

  it("PDF corrompido (a extração falha): ilegível, nunca rejeita", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);

    expect(await ler(new Error("Invalid PDF structure"))).toEqual({
      lido: false,
      motivo: "ilegivel",
    });
  });
});
