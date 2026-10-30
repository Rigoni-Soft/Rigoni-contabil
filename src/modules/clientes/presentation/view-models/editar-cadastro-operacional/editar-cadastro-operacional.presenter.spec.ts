import {
  contatoNovo,
  descartarLinhasEmBranco,
  leituraDaLinha,
  parcelamentoNovo,
  reposicionarErros,
  resumoDoAcordo,
} from "./editar-cadastro-operacional.presenter";

describe("resumoDoAcordo", () => {
  it("junta órgão, parcelas, valor e data de adesão, na ordem", () => {
    expect(
      resumoDoAcordo({
        origem: "receita_federal",
        totalDeParcelas: 7,
        valorDaParcelaCentavos: 31620,
        dataDeAdesao: "2026-08-27",
      }),
    ).toMatch(/^Receita Federal · 7 parcelas · R\$\s316,20 · adesão 27\/08\/2026$/);
  });

  it("omite o que o PDF não trouxe; uma parcela fica no singular", () => {
    expect(
      resumoDoAcordo({
        origem: "pgfn",
        totalDeParcelas: 1,
        valorDaParcelaCentavos: null,
        dataDeAdesao: null,
      }),
    ).toBe("PGFN · 1 parcela");
  });

  it.each([
    [undefined],
    [{ origem: null, totalDeParcelas: null, valorDaParcelaCentavos: null, dataDeAdesao: null }],
  ])("sem nenhum dado, nenhum resumo (%j)", (acordo) => {
    expect(resumoDoAcordo(acordo)).toBe("");
  });
});

describe("leituraDaLinha", () => {
  it("lendo: o texto nomeia a operação", () => {
    expect(leituraDaLinha({ estado: "lendo" })).toEqual({ estado: "lendo", texto: "Lendo o PDF…" });
  });

  it("sugerido: pede para conferir; sem código no PDF, diz que o sistema gerou um", () => {
    expect(leituraDaLinha({ estado: "sugerido", codigoGerado: false, cnpjConfere: true })).toEqual({
      estado: "sugerido",
      texto: "Sugerido pelo PDF: confira",
      cnpjDivergente: false,
    });
    expect(
      leituraDaLinha({ estado: "sugerido", codigoGerado: true, cnpjConfere: null }).texto,
    ).toBe("Sugerido pelo PDF: confira. O PDF não traz código: gerei um, você pode trocar.");
  });

  it.each([
    [true, false],
    [null, false],
    [false, true],
  ])("CNPJ confere = %s: divergente = %s (só o false avisa)", (cnpjConfere, divergente) => {
    expect(
      leituraDaLinha({ estado: "sugerido", codigoGerado: false, cnpjConfere }).cnpjDivergente,
    ).toBe(divergente);
  });

  it("falhou: manda digitar à mão", () => {
    expect(leituraDaLinha({ estado: "falhou" })).toEqual({
      estado: "falhou",
      texto: "não consegui ler: digite à mão",
    });
  });
});

describe("linhas abertas de nascença", () => {
  const contatoPreenchido = { nome: "Maria", telefone: "11999990000", padrao: true };

  it("descarta contato e parcelamento que ninguém tocou e informa os índices mantidos", () => {
    const r = descartarLinhasEmBranco({
      contatos: [contatoNovo(true), contatoPreenchido],
      parcelamentos: [parcelamentoNovo(), { ...parcelamentoNovo(), codigo: "A-1" }],
    });

    expect(r.valores.contatos).toEqual([contatoPreenchido]);
    expect(r.valores.parcelamentos.map((p) => p.codigo)).toEqual(["A-1"]);
    expect(r.contatos).toEqual([1]);
    expect(r.parcelamentos).toEqual([1]);
  });

  it("linha com PDF, ou salva (com id), nunca é descartada", () => {
    const pdf = new File(["%PDF"], "a.pdf", { type: "application/pdf" });
    const r = descartarLinhasEmBranco({
      contatos: [{ id: "c1", nome: "", telefone: "", padrao: true }],
      parcelamentos: [
        { ...parcelamentoNovo(), arquivo: pdf },
        { ...parcelamentoNovo(), id: "p1" },
      ],
    });

    expect(r.contatos).toEqual([0]);
    expect(r.parcelamentos).toEqual([0, 1]);
  });

  it("devolve cada erro à linha que tem na tela", () => {
    const erro = { message: "obrigatório" };

    const r = reposicionarErros([erro], [2]) as unknown[];

    expect(r[2]).toBe(erro);
    expect(r[0]).toBeUndefined();
    expect(reposicionarErros({ message: "lista" }, [2])).toEqual({ message: "lista" });
  });
});
