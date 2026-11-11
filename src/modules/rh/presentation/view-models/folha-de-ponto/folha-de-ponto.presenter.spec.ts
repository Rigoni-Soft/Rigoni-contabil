import type { FolhaDePontoDto } from "@/modules/rh/application/dtos/folha-de-ponto.dto";
import {
  hmParaMinutos,
  hrefDaFolha,
  itensDaTotalizacao,
  lerDiaDoFormulario,
  lerEmpregadoDoFormulario,
  linhasDoCartao,
  minutosParaHm,
  navegacaoDoCartao,
  quadroDoEmpregado,
} from "@/modules/rh/presentation/view-models/folha-de-ponto/folha-de-ponto.presenter";

const campos = (valores: Record<string, string>) => ({
  get: (nome: string) => valores[nome] ?? null,
});
const ANA = {
  id: "e1",
  nome: "Ana",
  jornada: [0, 525, 525, 525, 525, 525, 240],
  comissionado: true,
  ativo: true,
  semMovimento: false,
};
const FOLHA: FolhaDePontoDto = {
  clienteId: "c1",
  competencia: "2020-11",
  quinzena: 2,
  padraoComissionados: false,
  empregados: [ANA, { ...ANA, id: "e2", nome: "Bia", ativo: false, comissionado: false }],
  podeEditar: true,
  selecionado: { empregado: ANA, dias: [], totalizacao: {} as never, semConvencao: false },
};

describe("horários", () => {
  it("converte entre minutos e HH:MM", () => {
    expect(minutosParaHm(525)).toBe("08:45");
    expect(hmParaMinutos("08:45")).toBe(525);
    expect(hmParaMinutos("24:00")).toBeNull();
    expect(hmParaMinutos("")).toBeNull();
  });
});

describe("itensDaTotalizacao", () => {
  it("formata horas e dias", () => {
    const itens = itensDaTotalizacao({
      normaisMin: 525,
      extras: [{ percentual: 60, minutos: 60 }],
      bancoDeHorasMin: 0,
      acimaDoLimiteMin: 0,
      noturnoMin: 69,
      atrasoMin: 5,
      faltas: 1,
      abonoDias: 2,
      abonoMin: 1050,
      feriadosTrabalhados: 1,
      sabadosTrabalhados: 2,
      diasComLanche: 3,
    });
    expect(itens.map((i) => i.rotulo)).toContain("Extras 60%");
    expect(itens.map((i) => i.valor)).toEqual([
      "8h45",
      "1h00",
      "1h09",
      "0h05",
      "1 dia",
      "2 dias · 17h30",
      "1",
      "2",
      "3",
    ]);
  });
});

describe("linhasDoCartao", () => {
  it("rotula o dia e marca feriado e dia sem jornada", () => {
    const base = { batidas: [], extra: null, abono: false, cargaMin: 525, feriado: false };
    const [seg, dom, fer] = linhasDoCartao([
      { ...base, data: "2026-11-16", diaDaSemana: 1, batidas: [{ entrada: 480, saida: 720 }] },
      {
        ...base,
        data: "2026-11-22",
        diaDaSemana: 0,
        cargaMin: 0,
        extra: { entrada: 480, saida: 600 },
      },
      { ...base, data: "2026-11-20", diaDaSemana: 5, feriado: true },
    ]);
    expect(seg).toMatchObject({
      rotulo: "seg 16/11",
      entrada1: "08:00",
      saida1: "12:00",
      entrada2: "",
    });
    expect(seg.nota).toBeUndefined();
    expect(dom).toMatchObject({ nota: "Sem jornada", extraEntrada: "08:00", extraSaida: "10:00" });
    expect(fer.nota).toBe("Feriado");
  });
});

describe("lerDiaDoFormulario", () => {
  it("lê pares, extra e abono", () => {
    expect(
      lerDiaDoFormulario(
        campos({
          entrada1: "08:00",
          saida1: "12:00",
          extraEntrada: "18:00",
          extraSaida: "19:00",
          abono: "on",
        }),
      ),
    ).toEqual({
      ok: true,
      batidas: [{ entrada: 480, saida: 720 }],
      extra: { entrada: 1080, saida: 1140 },
      abono: true,
    });
  });

  it("dia em branco é válido (apaga o dia)", () => {
    expect(lerDiaDoFormulario(campos({}))).toEqual({
      ok: true,
      batidas: [],
      extra: null,
      abono: false,
    });
  });

  it("par pela metade ou com entrada igual à saída é erro", () => {
    expect(lerDiaDoFormulario(campos({ entrada1: "08:00" })).ok).toBe(false);
    expect(lerDiaDoFormulario(campos({ entrada1: "08:00", saida1: "08:00" })).ok).toBe(false);
  });
});

describe("lerEmpregadoDoFormulario", () => {
  const cargas = Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((i) => [`carga${i}`, "08:00"]));

  it("lê nome, Jornada e a marca", () => {
    expect(
      lerEmpregadoDoFormulario(campos({ nome: " Ana ", ...cargas, comissionado: "on" })),
    ).toEqual({
      ok: true,
      nome: "Ana",
      jornada: [480, 480, 480, 480, 480, 480, 480],
      comissionado: true,
    });
  });

  it("recusa Jornada incompleta", () => {
    expect(lerEmpregadoDoFormulario(campos({ nome: "Ana", ...cargas, carga3: "" })).ok).toBe(false);
  });
});

describe("quadro e navegação", () => {
  it("lista o quadro com selos e destaca o escolhido", () => {
    const [ana, bia] = quadroDoEmpregado(FOLHA);
    expect(ana).toMatchObject({ selecionado: true, selos: ["comissionado"] });
    expect(ana.href).toBe("/rh/folha-de-ponto/c1?mes=2020-11&quinzena=2&empregado=e1");
    expect(bia).toMatchObject({ selecionado: false, selos: ["inativo"] });
  });

  it("navega entre meses (sem próximo no mês corrente) e quinzenas", () => {
    const nav = navegacaoDoCartao(FOLHA);
    expect(nav.mesAnteriorHref).toContain("mes=2020-10&quinzena=1");
    expect(nav.proximoMesHref).toContain("mes=2020-12");
    expect(nav.quinzenas.map((q) => q.atual)).toEqual([false, true]);
    expect(navegacaoDoCartao({ ...FOLHA, competencia: "2099-01" }).proximoMesHref).toBeUndefined();
  });

  it("hrefDaFolha omite o que não foi pedido", () => {
    expect(hrefDaFolha("c 1", {})).toBe("/rh/folha-de-ponto/c%201");
  });
});
