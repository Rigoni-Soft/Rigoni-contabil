import type { AcompanhamentoMensalDto } from "@/modules/rh/application/dtos/acompanhamento.dto";

import {
  cardsDoAcompanhamento,
  configuracoesDoRh,
  fatiasDoAcompanhamento,
} from "./resumo-rh.presenter";

const celula = (servicoId: string, aplica: boolean, concluido: boolean) => ({
  servicoId,
  aplica,
  concluido,
});
const MENSAL: AcompanhamentoMensalDto = {
  competencia: "2026-11",
  servicos: [
    { id: "fgts", nome: "FGTS", sistema: false },
    { id: "holerite", nome: "Holerite", sistema: true },
  ],
  linhas: [
    {
      clienteId: "a",
      empresa: "A",
      cnpj: "1",
      celulas: [celula("fgts", true, true), celula("holerite", true, false)],
    },
    {
      clienteId: "b",
      empresa: "B",
      cnpj: "2",
      celulas: [celula("fgts", true, false), celula("holerite", false, false)],
    },
    {
      clienteId: "c",
      empresa: "C",
      cnpj: "3",
      celulas: [celula("fgts", true, true), celula("holerite", true, true)],
    },
  ],
  podeMarcar: true,
};

describe("cardsDoAcompanhamento", () => {
  it("um card por serviço com quem falta nele (não se aplica não conta) e o card Tudo concluído", () => {
    const { cards, grupo } = cardsDoAcompanhamento(MENSAL);

    expect(
      cards.map((c) => [c.id, c.titulo, c.quantidade, c.clientes.map((x) => x.clienteId)]),
    ).toEqual([
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

describe("fatiasDoAcompanhamento", () => {
  it("separa quem fechou o mês de quem ainda tem serviço faltando", () => {
    expect(fatiasDoAcompanhamento(MENSAL).map((f) => [f.id, f.quantidade])).toEqual([
      ["concluido", 1],
      ["pendente", 2],
    ]);
  });
});

describe("configuracoesDoRh", () => {
  it("só quem gere os serviços recebe o item de configuração", () => {
    expect(configuracoesDoRh(true, "/rh")).toEqual([
      { rotulo: "Serviços do acompanhamento", href: "/rh/servicos" },
    ]);
    expect(configuracoesDoRh(false, "/rh")).toBeUndefined();
  });
});
