import {
  linksDoMes,
  passosDaTroca,
  resumoDoHolerite,
  rotuloDaCompetencia,
  servicosDoCliente,
} from "./acompanhamento-mensal.presenter";

describe("acompanhamento-mensal.presenter", () => {
  it("rotula a competência por extenso", () => {
    expect(rotuloDaCompetencia("2026-03")).toBe("março de 2026");
  });

  it("monta os serviços do cliente e bloqueia o do sistema; cliente fora da vista não tem", () => {
    const dto = {
      competencia: "2026-11",
      podeMarcar: true,
      servicos: [
        { id: "a", nome: "FGTS", sistema: false },
        { id: "b", nome: "SIB", sistema: false },
        { id: "c", nome: "NUTRI", sistema: false },
        { id: "h", nome: "Holerite", sistema: true },
      ],
      linhas: [
        {
          clienteId: "c1",
          empresa: "Alfa",
          cnpj: "1",
          holerite: { cadastrados: 3, semMovimento: 1, cartoes: 1 },
          celulas: [
            { servicoId: "a", aplica: true, sempre: false, concluido: true },
            { servicoId: "b", aplica: false, sempre: false, concluido: false },
            { servicoId: "c", aplica: true, sempre: false, concluido: false },
            { servicoId: "h", aplica: true, sempre: false, concluido: false },
          ],
        },
      ],
    };

    expect(
      servicosDoCliente(dto, "c1").servicos.map((s) => [s.nome, s.estado, s.bloqueio]),
    ).toEqual([
      ["FGTS", "concluido", undefined],
      ["SIB", "nao_aplica", undefined],
      ["NUTRI", "pendente", undefined],
      ["Holerite", "pendente", "O Holerite é preenchido pelo sistema."],
    ]);
    expect(servicosDoCliente(dto, "c1").aviso).toBeUndefined();
    expect(servicosDoCliente(dto, "c1").resumoDoHolerite).toBe(
      "3 empregados cadastrados, 1 sem movimento · 1 de 2 cartões feitos no mês",
    );
    expect(servicosDoCliente(dto, "outro").resumoDoHolerite).toBeUndefined();
    const { servicos, aviso } = servicosDoCliente(dto, "outro");
    expect(aviso).toMatch(/não está na sua vista/);
    expect(servicos.map((s) => [s.nome, s.estado, s.bloqueio])).toEqual([
      ["FGTS", "pendente", aviso],
      ["SIB", "pendente", aviso],
      ["NUTRI", "pendente", aviso],
      ["Holerite", "pendente", "O Holerite é preenchido pelo sistema."],
    ]);
  });

  it("resume o Holerite do cliente com e sem empregados", () => {
    expect(resumoDoHolerite({ cadastrados: 1, semMovimento: 0, cartoes: 0 })).toBe(
      "1 empregado cadastrado · 0 de 1 cartão feito no mês",
    );
    expect(resumoDoHolerite({ cadastrados: 0, semMovimento: 0, cartoes: 0 })).toBe(
      "Sem empregados cadastrados: não há Holerite a cumprir.",
    );
  });

  it("troca o estado da célula na ordem que nunca deixa concluído um serviço que não se aplica", () => {
    expect(passosDaTroca("pendente", "concluido")).toEqual([{ tipo: "marcar", valor: true }]);
    expect(passosDaTroca("concluido", "pendente")).toEqual([{ tipo: "marcar", valor: false }]);
    expect(passosDaTroca("pendente", "nao_aplica")).toEqual([{ tipo: "aplicar", escopo: "mes" }]);
    expect(passosDaTroca("pendente", "nunca_aplica")).toEqual([
      { tipo: "aplicar", escopo: "sempre" },
    ]);
    expect(passosDaTroca("concluido", "nao_aplica")).toEqual([
      { tipo: "marcar", valor: false },
      { tipo: "aplicar", escopo: "mes" },
    ]);
    expect(passosDaTroca("nao_aplica", "nunca_aplica")).toEqual([
      { tipo: "aplicar", escopo: "sempre" },
    ]);
    expect(passosDaTroca("nao_aplica", "pendente")).toEqual([
      { tipo: "aplicar", escopo: "aplica" },
    ]);
    expect(passosDaTroca("nunca_aplica", "concluido")).toEqual([
      { tipo: "aplicar", escopo: "aplica" },
      { tipo: "marcar", valor: true },
    ]);
    expect(passosDaTroca("pendente", "pendente")).toEqual([]);
  });
});

describe("linksDoMes", () => {
  it("monta anterior e próximo, preservando voltarPara", () => {
    expect(linksDoMes("c1", "2026-10", "2026-11", "/rh")).toEqual({
      anteriorHref: "/clientes/c1?mes=2026-09&voltarPara=%2Frh",
      proximoHref: "/clientes/c1?mes=2026-11&voltarPara=%2Frh",
    });
  });

  it("no mês corrente não há próximo", () => {
    expect(linksDoMes("c1", "2026-11", "2026-11").proximoHref).toBeUndefined();
  });
});
