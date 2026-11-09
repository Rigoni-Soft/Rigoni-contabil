import type { DetalheDoFuncionarioDto } from "@/modules/rh/application/dtos/acompanhamento.dto";

import {
  funcionariosDoGrafico,
  linksDoMesDosFuncionarios,
  percentual,
  propsDoDetalhe,
  semResponsavelDoGrafico,
  tituloDaListaDeFalta,
} from "./acompanhamento-funcionarios.presenter";

describe("acompanhamento-funcionarios.presenter", () => {
  it("arredonda o percentual e trata zero atribuídos como 0%", () => {
    expect(percentual(1, 3)).toBe(33);
    expect(percentual(2, 3)).toBe(67);
    expect(percentual(0, 0)).toBe(0);
  });

  it("monta o link do funcionário com o mês consultado e o percentual", () => {
    const [f] = funcionariosDoGrafico(
      {
        competencia: "2026-11",
        semResponsavel: [],
        funcionarios: [{ id: "f1", nome: "Ana", atribuidos: 4, pontos: 1, faltam: [] }],
      },
      "/rh/funcionarios",
    );
    expect(f.href).toBe("/rh/funcionarios/f1?mes=2026-11");
    expect(f.percentual).toBe(25);
  });

  it("cada falta por serviço leva à lista das empresas e o sem responsável, ao cadastro", () => {
    const dto = {
      competencia: "2026-11",
      semResponsavel: [{ clienteId: "c9", empresa: "Padaria Sol", cnpj: "9" }],
      funcionarios: [
        {
          id: "f1",
          nome: "Ana",
          atribuidos: 4,
          pontos: 1,
          faltam: [{ servicoId: "s1", nome: "FGTS", clientes: 2 }],
        },
      ],
    };

    const [f] = funcionariosDoGrafico(dto, "/rh/funcionarios");
    const [c] = semResponsavelDoGrafico(dto, "/rh/funcionarios");

    expect(f.faltam[0].href).toBe("/rh/funcionarios/f1/s1?mes=2026-11");
    expect(c.href).toBe("/clientes/c9?voltarPara=%2Frh%2Ffuncionarios");
  });

  it("os links de mês trazem o anterior e o próximo, que some no mês corrente", () => {
    expect(linksDoMesDosFuncionarios("/rh/funcionarios", "2026-10", "2026-11")).toEqual({
      anteriorHref: "/rh/funcionarios?mes=2026-09",
      proximoHref: "/rh/funcionarios?mes=2026-11",
    });
    expect(
      linksDoMesDosFuncionarios("/rh/funcionarios", "2026-11", "2026-11").proximoHref,
    ).toBeUndefined();
  });

  it("o título da lista de falta existe só para um funcionário e serviço conhecidos", () => {
    const dto = {
      competencia: "2026-11",
      semResponsavel: [],
      funcionarios: [
        {
          id: "f1",
          nome: "Ana",
          atribuidos: 1,
          pontos: 0,
          faltam: [{ servicoId: "s1", nome: "FGTS", clientes: 1 }],
        },
      ],
    };

    expect(tituloDaListaDeFalta(dto, "f1", "s1")).toBe("FGTS pendente: Ana");
    expect(tituloDaListaDeFalta(dto, "f1", "inexistente")).toBeUndefined();
    expect(tituloDaListaDeFalta(dto, "outro", "s1")).toBeUndefined();
  });

  it("rotula o mês e a evolução por extenso", () => {
    const detalhe: DetalheDoFuncionarioDto = {
      funcionario: { id: "f1", nome: "Ana", atribuidos: 2, pontos: 1, faltam: [] },
      pendencias: [],
      evolucao: [
        { competencia: "2026-10", pontos: 0, atribuidos: 2 },
        { competencia: "2026-11", pontos: 1, atribuidos: 2 },
      ],
      maisAtrasados: [],
    };
    const props = propsDoDetalhe(detalhe, "2026-11", "/rh/funcionarios/f1?mes=2026-11");
    expect(props.rotuloMes).toBe("novembro de 2026");
    expect(props.percentual).toBe(50);
    expect(props.evolucao).toEqual([
      { competencia: "2026-10", rotulo: "outubro de 2026", percentual: 0 },
      { competencia: "2026-11", rotulo: "novembro de 2026", percentual: 50 },
    ]);
  });
});
