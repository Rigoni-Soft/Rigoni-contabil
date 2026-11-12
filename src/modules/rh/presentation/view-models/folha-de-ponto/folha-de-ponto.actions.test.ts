/**
 * Integração presentation ↔ application: o `main` é substituído por uma composição com casos de
 * uso falsos (testes.md, seção 3), sem tocar Supabase.
 */
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok } from "@/shared/kernel/result";

import {
  cadastrarEmpregadoAction,
  corrigirEmpregadoAction,
  definirEmpregadoAtivoAction,
  definirPadraoComissionadosAction,
  definirSemMovimentoAction,
  iniciarCartaoDoPontoAction,
  salvarDiaDoPontoAction,
} from "./folha-de-ponto.actions";

const ID = "11111111-1111-4111-8111-111111111111";
const JORNADA = [0, 480, 480, 480, 480, 480, 0];

const casos = {
  cadastrar: jest.fn(),
  corrigir: jest.fn(),
  ativo: jest.fn(),
  semMovimento: jest.fn(),
  padrao: jest.fn(),
  salvarDia: jest.fn(),
  iniciar: jest.fn(),
};

jest.mock("@/main/rh.factory", () => ({
  makeCadastrarEmpregado: async () => ({ execute: casos.cadastrar }),
  makeCorrigirEmpregado: async () => ({ execute: casos.corrigir }),
  makeDefinirEmpregadoAtivo: async () => ({ execute: casos.ativo }),
  makeDefinirSemMovimento: async () => ({ execute: casos.semMovimento }),
  makeDefinirPadraoComissionados: async () => ({ execute: casos.padrao }),
  makeSalvarDiaDoPonto: async () => ({ execute: casos.salvarDia }),
  makeIniciarCartaoDoPonto: async () => ({ execute: casos.iniciar }),
}));

const FECHA = { ok: true, data: undefined };

describe("folha-de-ponto.actions (integração)", () => {
  beforeEach(() => {
    for (const caso of Object.values(casos)) caso.mockReset().mockResolvedValue(ok(undefined));
  });

  it.each([
    [
      "cadastrar",
      cadastrarEmpregadoAction,
      "cadastrar",
      { clienteId: ID, nome: "Ana", jornada: JORNADA },
    ],
    [
      "corrigir",
      corrigirEmpregadoAction,
      "corrigir",
      { empregadoId: ID, nome: "Ana", jornada: JORNADA, comissionado: false },
    ],
    ["ativo", definirEmpregadoAtivoAction, "ativo", { empregadoId: ID, ativo: false }],
    [
      "sem movimento",
      definirSemMovimentoAction,
      "semMovimento",
      { empregadoId: ID, competencia: "2026-11", sem: true },
    ],
    ["padrão", definirPadraoComissionadosAction, "padrao", { clienteId: ID, comissionados: true }],
    ["iniciar", iniciarCartaoDoPontoAction, "iniciar", { empregadoId: ID, competencia: "2026-11" }],
    [
      "salvar dia",
      salvarDiaDoPontoAction,
      "salvarDia",
      {
        empregadoId: ID,
        data: "2026-11-03",
        batidas: [{ entrada: 480, saida: 1020 }],
        extra: null,
        abono: false,
      },
    ],
  ])("%s: entrega os dados validados ao caso de uso", async (_nome, action, caso, input) => {
    expect(await action(input)).toEqual(FECHA);
    expect(casos[caso as keyof typeof casos]).toHaveBeenCalledWith(input);
  });

  it.each([
    [
      "cadastrar sem nome",
      cadastrarEmpregadoAction,
      { clienteId: ID, nome: " ", jornada: JORNADA },
    ],
    [
      "cadastrar com jornada de 6 dias",
      cadastrarEmpregadoAction,
      { clienteId: ID, nome: "Ana", jornada: [0, 1, 2, 3, 4, 5] },
    ],
    [
      "corrigir com id inválido",
      corrigirEmpregadoAction,
      { empregadoId: "x", nome: "Ana", jornada: JORNADA, comissionado: true },
    ],
    ["ativo sem corpo", definirEmpregadoAtivoAction, undefined],
    [
      "sem movimento com mês inválido",
      definirSemMovimentoAction,
      { empregadoId: ID, competencia: "2026-13", sem: true },
    ],
    ["padrão sem booleano", definirPadraoComissionadosAction, { clienteId: ID }],
    ["iniciar sem competência", iniciarCartaoDoPontoAction, { empregadoId: ID }],
    [
      "salvar dia com 5 pares",
      salvarDiaDoPontoAction,
      {
        empregadoId: ID,
        data: "2026-11-03",
        batidas: Array(5).fill({ entrada: 480, saida: 720 }),
        extra: null,
        abono: false,
      },
    ],
    [
      "salvar dia com data fora do formato",
      salvarDiaDoPontoAction,
      { empregadoId: ID, data: "03/11/2026", batidas: [], extra: null, abono: false },
    ],
  ])("%s: VALIDATION_ERROR, sem chamar o caso de uso", async (_nome, action, input) => {
    expect(await action(input)).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });
    for (const caso of Object.values(casos)) expect(caso).not.toHaveBeenCalled();
  });

  it("devolve o erro do caso de uso (Forbidden)", async () => {
    casos.salvarDia.mockResolvedValue(err(new ForbiddenError("Sem permissão.")));

    expect(
      await salvarDiaDoPontoAction({
        empregadoId: ID,
        data: "2026-11-03",
        batidas: [],
        extra: null,
        abono: false,
      }),
    ).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
  });
});
