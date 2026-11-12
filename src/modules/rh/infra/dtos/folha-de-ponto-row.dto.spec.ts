import { convencaoRowSchema } from "./convencao-row.dto";
import { diaDoPontoRowSchema, empregadoRowSchema } from "./folha-de-ponto-row.dto";

const empregado = {
  id: "11111111-1111-1111-1111-111111111111",
  nome: "Ana",
  jornada: [0, 525, 525, 525, 525, 525, 240],
  comissionado: false,
  ativo: true,
};

describe("Row DTOs do RH", () => {
  it("aceita a linha no formato do banco", () => {
    expect(empregadoRowSchema.safeParse(empregado).success).toBe(true);
  });

  it("recusa jornada que não tem 7 dias ou traz valor fora do dia", () => {
    expect(empregadoRowSchema.safeParse({ ...empregado, jornada: [0, 525] }).success).toBe(false);
    expect(
      empregadoRowSchema.safeParse({ ...empregado, jornada: [null, 1, 1, 1, 1, 1, 0] }).success,
    ).toBe(false);
  });

  it("recusa dia com batida torta", () => {
    const dia = { data: "2026-11-16", batidas: [{ entrada: "08:00", saida: 720 }], extra: null };

    expect(diaDoPontoRowSchema.safeParse({ ...dia, abono: false }).success).toBe(false);
  });

  it("recusa regra da convenção fora do esquema fechado", () => {
    const linha = {
      id: empregado.id,
      sindicato: "Comércio",
      vigencia_inicio: "2026-05-01",
      vigencia_fim: "2027-04-30",
      arquivo_nome: "cct.pdf",
      criado_em: "2026-11-01T10:00:00Z",
      regras: { versao: 1, aplicadas: [], rejeitadas: [] },
    };
    const inventada = {
      ...linha,
      regras: {
        ...linha.regras,
        aplicadas: [{ chave: "salario", valor: 1, clausula: "1", trecho: "1" }],
      },
    };

    expect(convencaoRowSchema.safeParse(linha).success).toBe(true);
    expect(convencaoRowSchema.safeParse(inventada).success).toBe(false);
  });
});
