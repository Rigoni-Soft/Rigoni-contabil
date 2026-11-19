/**
 * Integração presentation ↔ application: o `main` é substituído por uma composição com o caso de
 * uso falso (testes.md, seção 3), sem tocar Supabase real.
 */
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok } from "@/shared/kernel/result";

import { salvarContatoAction } from "./salvar-contato.actions";

const executeMock = jest.fn();

jest.mock("@/main/clientes.factory", () => ({
  makeSalvarContatoDoCliente: () => ({ execute: executeMock }),
}));

const CLIENTE_ID = "c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1";
const INPUT_VALIDO = {
  clienteId: CLIENTE_ID,
  contato: { nome: "Maria Exemplo", telefone: "11999990000", email: "" },
};

describe("salvarContatoAction (integração)", () => {
  beforeEach(() => executeMock.mockReset());

  it.each([
    ["Cliente que não é UUID", { clienteId: "abc" }],
    ["contato sem WhatsApp nem e-mail", { contato: { nome: "Maria", telefone: "", email: "" } }],
    ["WhatsApp sem DDD", { contato: { nome: "Maria", telefone: "99999-0000", email: "" } }],
    ["e-mail inválido", { contato: { nome: "Maria", telefone: "", email: "maria" } }],
  ])("%s: VALIDATION_ERROR, sem chamar o caso de uso", async (_nome, parcial) => {
    const resultado = await salvarContatoAction({ ...INPUT_VALIDO, ...parcial });

    expect(resultado).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });
    expect(executeMock).not.toHaveBeenCalled();
  });

  it("entrada válida chama o caso de uso e devolve o id", async () => {
    executeMock.mockResolvedValue(ok({ id: "novo-id" }));

    const resultado = await salvarContatoAction(INPUT_VALIDO);

    expect(executeMock).toHaveBeenCalledWith(INPUT_VALIDO);
    expect(resultado).toEqual({ ok: true, data: { id: "novo-id" } });
  });

  it("erro do caso de uso vira ActionResult de falha", async () => {
    executeMock.mockResolvedValue(err(new ForbiddenError("Sem permissão.")));

    const resultado = await salvarContatoAction(INPUT_VALIDO);

    expect(resultado).toMatchObject({ ok: false, error: { message: "Sem permissão." } });
  });
});
