import {
  acharEmpregadoPeloNome,
  deduzirJornada,
  validarLeitura,
  type LeituraDoCartao,
} from "@/modules/rh/domain/services/leitura-do-cartao.service";

const h = (hh: number, mm = 0) => hh * 60 + mm;
const dia = (n: number, extra: Partial<LeituraDoCartao["dias"][number]> = {}) => ({
  dia: n,
  batidas: [
    { entrada: h(8, 30), saida: h(12) },
    { entrada: h(13, 30), saida: h(18) },
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
      { nome: "Erick", dias: [dia(1, { batidas: [{ entrada: h(13), saida: h(9) }] })] },
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
      { data: "2026-09-01", batidas: [{ entrada: h(8), saida: h(12) }], extra: null, abono: false },
      { data: "2026-09-02", batidas: [{ entrada: h(8), saida: h(17) }], extra: null, abono: false },
    ]);
    expect(jornada).toEqual([0, 0, 240, 540, 0, 0, 0]);
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
