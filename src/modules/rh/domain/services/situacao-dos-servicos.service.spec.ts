import {
  situacaoDosServicos,
  type FatosDoCliente,
} from "@/modules/rh/domain/services/situacao-dos-servicos.service";

const SERVICOS = [
  { id: "s-fgts", sistema: false },
  { id: "s-sib", sistema: false },
  { id: "s-hol", sistema: true },
];

const fatos = (parcial: Partial<FatosDoCliente> = {}): FatosDoCliente => ({
  naoAplica: [],
  naoAplicaSempre: [],
  concluidos: [],
  holerite: { cadastrados: 2, semMovimento: 0, cartoes: 2 },
  ...parcial,
});

const doServico = (situacao: ReturnType<typeof situacaoDosServicos>, id: string) =>
  situacao.servicos.find((s) => s.servicoId === id)!;

describe("situacaoDosServicos", () => {
  it("Serviço à mão sem marcação é pendente por não marcado; marcado é concluído", () => {
    const s = situacaoDosServicos(SERVICOS, fatos({ concluidos: ["s-fgts"] }));

    expect(doServico(s, "s-fgts")).toMatchObject({
      aplicavel: true,
      concluido: true,
      pendente: false,
    });
    expect(doServico(s, "s-sib")).toMatchObject({
      aplicavel: true,
      concluido: false,
      pendente: true,
      motivoDoPendente: "nao_marcado",
    });
    expect(s.ponto).toBe(false);
  });

  it("o que não se aplica não pesa; o 'nunca se aplica' vem com sempre", () => {
    const s = situacaoDosServicos(
      SERVICOS,
      fatos({
        naoAplica: ["s-fgts", "s-sib"],
        naoAplicaSempre: ["s-sib"],
        concluidos: [],
      }),
    );

    expect(doServico(s, "s-fgts")).toMatchObject({
      aplicavel: false,
      sempre: false,
      pendente: false,
    });
    expect(doServico(s, "s-sib")).toMatchObject({
      aplicavel: false,
      sempre: true,
      pendente: false,
    });
    expect(s.ponto).toBe(true);
  });

  it("o Holerite sai dos cartões: concluído com todos feitos, pendente por cartões faltando", () => {
    const feito = situacaoDosServicos(SERVICOS, fatos({ concluidos: ["s-fgts", "s-sib"] }));
    const falta = situacaoDosServicos(
      SERVICOS,
      fatos({
        concluidos: ["s-fgts", "s-sib"],
        holerite: { cadastrados: 2, semMovimento: 0, cartoes: 1 },
      }),
    );

    expect(doServico(feito, "s-hol")).toMatchObject({ aplicavel: true, concluido: true });
    expect(feito.ponto).toBe(true);
    expect(doServico(falta, "s-hol")).toMatchObject({
      concluido: false,
      pendente: true,
      motivoDoPendente: "cartoes_faltando",
    });
    expect(falta.ponto).toBe(false);
  });

  it("Cliente sem empregados não tem Holerite a cumprir; marca do adapter no Holerite não vale", () => {
    const s = situacaoDosServicos(
      SERVICOS,
      fatos({
        concluidos: ["s-fgts", "s-sib", "s-hol"],
        naoAplica: ["s-hol"],
        holerite: { cadastrados: 0, semMovimento: 0, cartoes: 0 },
      }),
    );

    expect(doServico(s, "s-hol")).toMatchObject({
      aplicavel: false,
      concluido: false,
      pendente: false,
    });
    expect(s.ponto).toBe(true);
  });

  it("sem Serviço do sistema no mês só valem os Serviços à mão; sem Serviços há ponto", () => {
    expect(situacaoDosServicos([SERVICOS[0]], fatos()).ponto).toBe(false);
    expect(situacaoDosServicos([], fatos()).servicos).toEqual([]);
    expect(situacaoDosServicos([], fatos()).ponto).toBe(true);
  });
});
