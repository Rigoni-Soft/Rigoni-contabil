import type {
  AcompanhamentoFuncionariosDto,
  AcompanhamentoMensalDto,
} from "@/modules/rh/application/dtos/acompanhamento.dto";

import { cardsDoAcompanhamento, cardsDosFuncionarios } from "./resumo-rh.presenter";

const celula = (servicoId: string, aplica: boolean, concluido: boolean) => ({ servicoId, aplica, concluido });
const MENSAL: AcompanhamentoMensalDto = {
  competencia: "2026-11",
  servicos: [
    { id: "fgts", nome: "FGTS", sistema: false },
    { id: "holerite", nome: "Holerite", sistema: true },
  ],
  linhas: [
    { clienteId: "a", empresa: "A", cnpj: "1", celulas: [celula("fgts", true, true), celula("holerite", true, false)] },
    { clienteId: "b", empresa: "B", cnpj: "2", celulas: [celula("fgts", true, false), celula("holerite", false, false)] },
    { clienteId: "c", empresa: "C", cnpj: "3", celulas: [celula("fgts", true, true), celula("holerite", true, true)] },
  ],
  podeMarcar: true,
  podeGerirServicos: true,
};

describe("cardsDoAcompanhamento", () => {
  it("um card por serviço com quem falta nele (não se aplica não conta) e o card Tudo concluído", () => {
    const { cards, grupo } = cardsDoAcompanhamento(MENSAL);

    expect(cards.map((c) => [c.id, c.titulo, c.quantidade, c.clientes.map((x) => x.clienteId)])).toEqual([
      ["servico_fgts", "FGTS pendente", 1, ["b"]],
      ["servico_holerite", "Holerite pendente", 1, ["a"]],
      ["servicos_concluidos", "Tudo concluído", 1, ["c"]],
    ]);
    expect(cards.every((c) => c.total === 3)).toBe(true);
    expect(grupo).toEqual({
      titulo: "Acompanhamento de novembro de 2026",
      cardIds: ["servico_fgts", "servico_holerite", "servicos_concluidos"],
    });
  });
});

describe("cardsDosFuncionarios", () => {
  it("um card por Funcionário, com pontos sobre atribuídos, que abre o acompanhamento dele", () => {
    const dto: AcompanhamentoFuncionariosDto = {
      competencia: "2026-11",
      funcionarios: [
        { id: "u1", nome: "Ana", atribuidos: 4, pontos: 4 },
        { id: "u2", nome: "Beto", atribuidos: 3, pontos: 1 },
      ],
    };

    const { cards } = cardsDosFuncionarios(dto, "/rh/funcionarios");

    expect(cards.map((c) => [c.titulo, c.cor, c.quantidade, c.total, c.href])).toEqual([
      ["Ana", "em_dia", 4, 4, "/rh/funcionarios/u1?mes=2026-11"],
      ["Beto", "atencao", 1, 3, "/rh/funcionarios/u2?mes=2026-11"],
    ]);
  });
});
