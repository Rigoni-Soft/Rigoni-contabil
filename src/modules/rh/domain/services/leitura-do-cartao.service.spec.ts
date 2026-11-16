import {
  acharEmpregadoPeloNome,
  deduzirJornada,
  diasAGravar,
  validarLeitura,
  type LeituraDoCartao,
} from "@/modules/rh/domain/services/leitura-do-cartao.service";

const emMinutos = (horas: number, minutos = 0) => horas * 60 + minutos;
const dia = (n: number, extra: Partial<LeituraDoCartao["dias"][number]> = {}) => ({
  dia: n,
  batidas: [
    { entrada: emMinutos(8, 30), saida: emMinutos(12) },
    { entrada: emMinutos(13, 30), saida: emMinutos(18) },
  ],
  extra: null,
  atestado: false,
  faltou: false,
  ...extra,
});
const alvo = { competencia: "2026-09", quinzena: 1 as const };

describe("validarLeitura", () => {
  it("aceita um cartão coerente e ignora a linha em branco", () => {
    const r = validarLeitura(
      { nome: " Erick ", dias: [dia(1), dia(2, { batidas: [] }), dia(3)] },
      alvo,
    );
    expect(r.ok && r.value.nome).toBe("Erick");
    expect(r.ok && r.value.dias.map((d) => d.data)).toEqual(["2026-09-01", "2026-09-03"]);
  });

  it("sinaliza falta e abono por anotação", () => {
    const r = validarLeitura(
      {
        nome: "Erick",
        dias: [
          dia(1),
          dia(2, { batidas: [], faltou: true }),
          dia(3, { batidas: [], atestado: true }),
        ],
      },
      alvo,
    );
    expect(r.ok && r.value.faltas).toEqual(["2026-09-02"]);
    expect(r.ok && r.value.dias.find((d) => d.data === "2026-09-03")?.abono).toBe(true);
  });

  it.each([
    ["nome ilegível", { nome: "E!r#", dias: [dia(1)] }],
    ["sem nome", { nome: null, dias: [dia(1)] }],
    ["dia de outra quinzena", { nome: "Erick", dias: [dia(16)] }],
    ["dia repetido", { nome: "Erick", dias: [dia(1), dia(1)] }],
    [
      "horário fora de ordem",
      {
        nome: "Erick",
        dias: [dia(1, { batidas: [{ entrada: emMinutos(13), saida: emMinutos(9) }] })],
      },
    ],
    [
      "minuto inválido (par fora do dia)",
      { nome: "Erick", dias: [dia(1, { batidas: [{ entrada: 2000, saida: 2100 }] })] },
    ],
    ["nenhum horário", { nome: "Erick", dias: [dia(1, { batidas: [] })] }],
  ])("reprova: %s", (_, leitura) => {
    expect(validarLeitura(leitura as LeituraDoCartao, alvo).ok).toBe(false);
  });

  it("a 2ª quinzena vai de 16 ao último dia do mês", () => {
    const q2 = { competencia: "2026-09", quinzena: 2 as const };
    expect(validarLeitura({ nome: "Erick", dias: [dia(30)] }, q2).ok).toBe(true);
    expect(validarLeitura({ nome: "Erick", dias: [dia(31)] }, q2).ok).toBe(false);
  });
});

describe("deduzirJornada", () => {
  it("usa a mediana do trabalhado por dia da semana; sem batida = zero", () => {
    // 2026-09-01 é terça; 2026-09-02, quarta.
    const jornada = deduzirJornada([
      {
        data: "2026-09-01",
        batidas: [{ entrada: emMinutos(8), saida: emMinutos(12) }],
        extra: null,
        abono: false,
      },
      {
        data: "2026-09-02",
        batidas: [{ entrada: emMinutos(8), saida: emMinutos(17) }],
        extra: null,
        abono: false,
      },
    ]);
    expect(jornada).toEqual([0, 0, 240, 540, 0, 0, 0]);
  });
});

describe("diasAGravar", () => {
  // Segunda a sexta 8h45, sábado 4h, domingo folga. 2026-09-01 terça, 09-05 sábado, 09-06 domingo.
  const jornada = [0, 525, 525, 525, 525, 525, 240] as const;
  const batida = [{ entrada: emMinutos(8), saida: emMinutos(12) }];
  const comBatida = (data: string) => ({ data, batidas: batida, extra: null, abono: false });
  const soAbono = (data: string) => ({ data, batidas: [], extra: null, abono: true });
  const nenhum = new Set<string>();

  it("grava os dias lidos em dia vazio", () => {
    const lidos = [comBatida("2026-09-01"), soAbono("2026-09-02")];
    expect(diasAGravar(lidos, jornada, nenhum, nenhum)).toEqual({ gravar: lidos, mantidos: 0 });
  });

  it("não toca no dia que já tem dado (batida digitada ou abono do atestado) e o conta como mantido", () => {
    const lidos = [comBatida("2026-09-01"), soAbono("2026-09-02"), comBatida("2026-09-03")];
    const { gravar, mantidos } = diasAGravar(
      lidos,
      jornada,
      nenhum,
      new Set(["2026-09-01", "2026-09-02"]),
    );
    expect(gravar.map((d) => d.data)).toEqual(["2026-09-03"]);
    expect(mantidos).toBe(2);
  });

  it("anotação de atestado sem batida em domingo ou feriado não vira abono, mas batida nesses dias grava", () => {
    const lidos = [soAbono("2026-09-06"), soAbono("2026-09-07"), comBatida("2026-09-07")];
    const feriados = new Set(["2026-09-07"]);
    const { gravar } = diasAGravar(lidos, jornada, feriados, nenhum);
    expect(gravar).toEqual([comBatida("2026-09-07")]);
  });
});

describe("acharEmpregadoPeloNome", () => {
  const quadro = [
    { id: "1", nome: "Érick Santos" },
    { id: "2", nome: "Laura Lima" },
    { id: "3", nome: "Laura Souza" },
  ];
  it("casa o primeiro nome sem acento nem caixa", () => {
    expect(acharEmpregadoPeloNome("ERICK", quadro)).toEqual({ tipo: "um", id: "1" });
  });
  it("não adivinha entre dois", () => {
    expect(acharEmpregadoPeloNome("Laura", quadro)).toEqual({ tipo: "varios" });
    expect(acharEmpregadoPeloNome("Laura Lima", quadro)).toEqual({ tipo: "um", id: "2" });
  });
  it("nome novo", () => {
    expect(acharEmpregadoPeloNome("Maycon", quadro)).toEqual({ tipo: "nenhum" });
  });
});
