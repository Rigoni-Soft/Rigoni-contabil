import {
  linksDoMes,
  mesVizinho,
  passosDaTroca,
  rotuloDaCompetencia,
  servicosDoCliente,
} from "./acompanhamento-mensal.presenter";

describe("acompanhamento-mensal.presenter", () => {
  it("rotula a competência por extenso", () => {
    expect(rotuloDaCompetencia("2026-03")).toBe("março de 2026");
  });

  it("acha o mês vizinho, virando o ano", () => {
    expect(mesVizinho("2026-01", -1)).toBe("2025-12");
    expect(mesVizinho("2025-12", 1)).toBe("2026-01");
    expect(mesVizinho("2026-05", -1)).toBe("2026-04");
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
          celulas: [
            { servicoId: "a", aplica: true, concluido: true },
            { servicoId: "b", aplica: false, concluido: false },
            { servicoId: "c", aplica: true, concluido: false },
            { servicoId: "h", aplica: true, concluido: false },
          ],
        },
      ],
    };

    expect(servicosDoCliente(dto, "c1").map((s) => [s.nome, s.estado, s.bloqueio])).toEqual([
      ["FGTS", "concluido", undefined],
      ["SIB", "nao_aplica", undefined],
      ["NUTRI", "pendente", undefined],
      ["Holerite", "pendente", "O Holerite é preenchido pelo sistema."],
    ]);
    expect(servicosDoCliente(dto, "outro").map((s) => [s.nome, s.estado, s.bloqueio])).toEqual([
      ["FGTS", "pendente", "O cliente não tem Responsável do RH; atribua um para marcar."],
      ["SIB", "pendente", "O cliente não tem Responsável do RH; atribua um para marcar."],
      ["NUTRI", "pendente", "O cliente não tem Responsável do RH; atribua um para marcar."],
      ["Holerite", "pendente", "O Holerite é preenchido pelo sistema."],
    ]);
  });

  it("troca o estado da célula na ordem que nunca deixa concluído um serviço que não se aplica", () => {
    expect(passosDaTroca("pendente", "concluido")).toEqual([{ tipo: "marcar", valor: true }]);
    expect(passosDaTroca("concluido", "pendente")).toEqual([{ tipo: "marcar", valor: false }]);
    expect(passosDaTroca("pendente", "nao_aplica")).toEqual([{ tipo: "aplicar", valor: false }]);
    expect(passosDaTroca("concluido", "nao_aplica")).toEqual([
      { tipo: "marcar", valor: false },
      { tipo: "aplicar", valor: false },
    ]);
    expect(passosDaTroca("nao_aplica", "pendente")).toEqual([{ tipo: "aplicar", valor: true }]);
    expect(passosDaTroca("nao_aplica", "concluido")).toEqual([
      { tipo: "aplicar", valor: true },
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
