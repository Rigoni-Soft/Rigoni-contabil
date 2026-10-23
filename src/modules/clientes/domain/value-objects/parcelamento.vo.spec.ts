import { sugerirParcelamento, validarParcelamento } from "./parcelamento.vo";

const base = {
  id: "p-1",
  codigo: "PARC-1",
  parcelasRestantes: 3,
  interno: false,
  arquivoCaminho: "c/p.pdf",
};

describe("validarParcelamento", () => {
  it("aceita código e parcelas restantes a partir de 1, sem espaços nas pontas", () => {
    const r = validarParcelamento({ ...base, codigo: "  PARC-1 ", parcelasRestantes: 1 });
    expect(r.ok && r.value).toEqual({ ...base, parcelasRestantes: 1 });
  });

  it.each([0, -1, 1.5, Number.NaN])("recusa %p parcelas restantes (mínimo 1, inteiro)", (n) => {
    expect(validarParcelamento({ ...base, parcelasRestantes: n }).ok).toBe(false);
  });

  it.each(["", "   ", "x".repeat(61)])("recusa o código %p", (codigo) => {
    expect(validarParcelamento({ ...base, codigo }).ok).toBe(false);
  });

  it("recusa sem anexo", () => {
    expect(validarParcelamento({ ...base, arquivoCaminho: " " }).ok).toBe(false);
  });
});

describe("dados do acordo (lidos do PDF)", () => {
  const acordo = {
    origem: "pgfn",
    totalDeParcelas: 5,
    valorDaParcelaCentavos: 26289,
    dataDeAdesao: "2026-01-27",
  } as const;

  it("a sugestão leva os dados do acordo lidos", () => {
    const r = sugerirParcelamento({
      lido: true,
      codigo: "15014167",
      quantidadeDeParcelas: 5,
      ...acordo,
    });

    expect(r).toMatchObject({ lido: true, codigo: "15014167", acordo });
  });

  it("dado do acordo inválido vira nulo, sem derrubar a leitura", () => {
    const r = sugerirParcelamento({
      lido: true,
      codigo: "A-1",
      quantidadeDeParcelas: 5,
      origem: "outra" as never,
      totalDeParcelas: 0,
      valorDaParcelaCentavos: -1,
      dataDeAdesao: "2026-13-40",
    });

    expect(r).toMatchObject({
      lido: true,
      acordo: {
        origem: null,
        totalDeParcelas: null,
        valorDaParcelaCentavos: null,
        dataDeAdesao: null,
      },
    });
  });

  it("ao salvar, o acordo vindo do formulário é revalidado (dado inválido vira nulo)", () => {
    const r = validarParcelamento({
      ...base,
      acordo: { ...acordo, totalDeParcelas: 1.5, dataDeAdesao: "ontem" },
    });

    expect(r.ok && r.value.acordo).toEqual({
      ...acordo,
      totalDeParcelas: null,
      dataDeAdesao: null,
    });
  });

  it("sem acordo informado, nada é acrescentado", () => {
    const r = validarParcelamento(base);

    expect(r.ok && "acordo" in r.value).toBe(false);
  });
});

describe("sugerirParcelamento: código", () => {
  const lida = (codigo: string | null) => ({
    lido: true as const,
    codigo,
    quantidadeDeParcelas: 3,
    origem: null,
    totalDeParcelas: null,
    valorDaParcelaCentavos: null,
    dataDeAdesao: null,
  });

  it.each([null, "", "   "])("código %j ausente: gera um interno", (codigo) => {
    const r = sugerirParcelamento(lida(codigo));

    expect(r.lido && r.codigoGerado).toBe(true);
    expect(r.lido && r.codigo).toMatch(/^PARC-[0-9A-F]{8}$/);
  });

  it("código lido é aparado e não é marcado como gerado", () => {
    expect(sugerirParcelamento(lida("  15014167 "))).toMatchObject({
      codigo: "15014167",
      codigoGerado: false,
    });
  });

  it("código lido com mais de 60 caracteres é leitura ilegível, não é trocado em silêncio", () => {
    expect(sugerirParcelamento(lida("9".repeat(61)))).toEqual({
      lido: false,
      motivo: "ilegivel",
    });
  });
});
