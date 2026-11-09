import type { DetalheDoFuncionarioDto } from "@/modules/rh/application/dtos/acompanhamento.dto";

import { percentual, propsDoDetalhe } from "./acompanhamento-funcionarios.presenter";

describe("acompanhamento-funcionarios.presenter", () => {
  it("arredonda o percentual e trata zero atribuídos como 0%", () => {
    expect(percentual(1, 3)).toBe(33);
    expect(percentual(2, 3)).toBe(67);
    expect(percentual(0, 0)).toBe(0);
  });

  it("rotula o mês e a evolução por extenso", () => {
    const detalhe: DetalheDoFuncionarioDto = {
      funcionario: { id: "f1", nome: "Ana", atribuidos: 2, pontos: 1 },
      pendencias: [],
      evolucao: [
        { competencia: "2026-10", pontos: 0, atribuidos: 2 },
        { competencia: "2026-11", pontos: 1, atribuidos: 2 },
      ],
      maisAtrasados: [],
    };
    const props = propsDoDetalhe(detalhe, "2026-11");
    expect(props.rotuloMes).toBe("novembro de 2026");
    expect(props.percentual).toBe(50);
    expect(props.evolucao).toEqual([
      { competencia: "2026-10", rotulo: "outubro de 2026", percentual: 0 },
      { competencia: "2026-11", rotulo: "novembro de 2026", percentual: 50 },
    ]);
  });
});
