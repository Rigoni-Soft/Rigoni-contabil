import { comHolerite, situacaoDoHolerite } from "./holerite.service";

const SERVICOS = [
  { id: "s-fgts", nome: "FGTS", sistema: false },
  { id: "s-hol", nome: "Holerite", sistema: true },
];

const cliente = (
  holerite: { cadastrados: number; semMovimento: number; cartoes: number },
  concluidos = ["s-fgts"],
) => ({ naoAplica: [] as string[], concluidos, holerite });

describe("situacaoDoHolerite", () => {
  it.each([
    [{ cadastrados: 0, semMovimento: 0, cartoes: 0 }, "nao_aplica"],
    [{ cadastrados: 2, semMovimento: 2, cartoes: 0 }, "nao_aplica"],
    [{ cadastrados: 3, semMovimento: 0, cartoes: 2 }, "pendente"],
    [{ cadastrados: 3, semMovimento: 0, cartoes: 3 }, "concluido"],
    [{ cadastrados: 3, semMovimento: 1, cartoes: 2 }, "concluido"],
  ] as const)("%j → %s", (contagem, esperado) => {
    expect(situacaoDoHolerite(contagem)).toBe(esperado);
  });
});

describe("comHolerite", () => {
  it("conclui, dispensa ou deixa pendente só a coluna do Holerite", () => {
    const [feito, vazio, falta] = comHolerite(
      [
        cliente({ cadastrados: 2, semMovimento: 0, cartoes: 2 }),
        cliente({ cadastrados: 0, semMovimento: 0, cartoes: 0 }),
        cliente({ cadastrados: 2, semMovimento: 0, cartoes: 1 }),
      ],
      SERVICOS,
    );

    expect(feito.concluidos).toEqual(["s-fgts", "s-hol"]);
    expect(feito.naoAplica).toEqual([]);
    expect(vazio.naoAplica).toEqual(["s-hol"]);
    expect(vazio.concluidos).toEqual(["s-fgts"]);
    expect(falta.concluidos).toEqual(["s-fgts"]);
    expect(falta.naoAplica).toEqual([]);
  });

  it("reabre o Holerite quando o cartão deixa de estar completo", () => {
    const [c] = comHolerite(
      [cliente({ cadastrados: 2, semMovimento: 0, cartoes: 1 }, ["s-fgts", "s-hol"])],
      SERVICOS,
    );

    expect(c.concluidos).toEqual(["s-fgts"]);
  });

  it("sem Serviço do sistema no mês devolve os clientes como vieram", () => {
    const clientes = [cliente({ cadastrados: 0, semMovimento: 0, cartoes: 0 })];

    expect(comHolerite(clientes, [SERVICOS[0]])).toBe(clientes);
  });
});
