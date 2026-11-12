/**
 * Integração presentation ↔ application das ações de leitura de foto (cartão e atestado): o `main` é
 * substituído por uma composição com casos de uso falsos (testes.md, seção 3), sem tocar Supabase.
 */
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok } from "@/shared/kernel/result";

import { lerAtestadoDePontoAction, lerCartaoDePontoAction } from "./folha-de-ponto.actions";
import { LIMITE_DA_FOTO, MENSAGEM_FOTO_GRANDE, MENSAGEM_SEM_FOTO } from "./folha-de-ponto.schema";

const ID = "11111111-1111-4111-8111-111111111111";

const casos = { cartao: jest.fn(), atestado: jest.fn() };

jest.mock("@/main/rh.factory", () => ({
  makeLerCartaoDePonto: async () => ({ execute: casos.cartao }),
  makeLerAtestadoDePonto: async () => ({ execute: casos.atestado }),
}));

const foto = (tipo = "image/jpeg", bytes = "foto") => new File([bytes], "foto.jpg", { type: tipo });

function formulario(campos: Record<string, string | File>): FormData {
  const dados = new FormData();
  for (const [chave, valor] of Object.entries(campos)) dados.append(chave, valor);
  return dados;
}

const cartao = (troca: Record<string, string | File> = {}) =>
  formulario({ clienteId: ID, competencia: "2026-11", quinzena: "2", imagem: foto(), ...troca });
const atestado = (troca: Record<string, string | File> = {}) =>
  formulario({ empregadoId: ID, imagem: foto(), ...troca });

describe("leitura-de-foto.actions (integração)", () => {
  beforeEach(() => {
    for (const caso of Object.values(casos)) caso.mockReset().mockResolvedValue(ok({}));
  });

  it("cartão: entrega os dados, a quinzena como número e os bytes da foto ao caso de uso", async () => {
    expect(await lerCartaoDePontoAction(cartao())).toEqual({ ok: true, data: {} });

    const entrada = casos.cartao.mock.calls[0][0];
    expect(entrada).toMatchObject({ clienteId: ID, competencia: "2026-11", quinzena: 2 });
    expect(entrada.imagem.tipo).toBe("image/jpeg");
    expect(Buffer.from(entrada.imagem.bytes).toString()).toBe("foto");
  });

  it("atestado: entrega o empregado e os bytes da foto ao caso de uso", async () => {
    expect(await lerAtestadoDePontoAction(atestado({ imagem: foto("image/png") }))).toEqual({
      ok: true,
      data: {},
    });

    const entrada = casos.atestado.mock.calls[0][0];
    expect(entrada.empregadoId).toBe(ID);
    expect(entrada.imagem.tipo).toBe("image/png");
  });

  it.each([
    ["cartão", lerCartaoDePontoAction, cartao, "cartao"],
    ["atestado", lerAtestadoDePontoAction, atestado, "atestado"],
  ] as const)(
    "%s: foto vazia, de outro tipo ou acima de 4 MB recusa com a mensagem da foto, sem chamar o caso de uso",
    async (_nome, action, montar, caso) => {
      const recusas = [
        [foto("image/jpeg", ""), MENSAGEM_SEM_FOTO],
        [foto("application/pdf"), MENSAGEM_SEM_FOTO],
        [foto("image/jpeg", "x".repeat(LIMITE_DA_FOTO + 1)), MENSAGEM_FOTO_GRANDE],
      ] as const;

      for (const [imagem, mensagem] of recusas) {
        expect(await action(montar({ imagem }))).toEqual({
          ok: false,
          error: { code: "VALIDATION_ERROR", message: mensagem },
        });
      }
      expect(casos[caso]).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["cartão com quinzena 3", lerCartaoDePontoAction, cartao({ quinzena: "3" })],
    ["cartão com mês inválido", lerCartaoDePontoAction, cartao({ competencia: "2026-13" })],
    ["atestado com empregado inválido", lerAtestadoDePontoAction, atestado({ empregadoId: "x" })],
  ])("%s: VALIDATION_ERROR, sem chamar o caso de uso", async (_nome, action, dados) => {
    expect(await action(dados)).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });
    for (const caso of Object.values(casos)) expect(caso).not.toHaveBeenCalled();
  });

  it.each([
    ["cartão", lerCartaoDePontoAction, cartao, "cartao"],
    ["atestado", lerAtestadoDePontoAction, atestado, "atestado"],
  ] as const)(
    "%s: devolve o erro do caso de uso (Forbidden)",
    async (_nome, action, montar, caso) => {
      casos[caso].mockResolvedValue(err(new ForbiddenError("Sem permissão.")));

      expect(await action(montar())).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    },
  );
});
