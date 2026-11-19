/**
 * Integração presentation ↔ application: o `main` é substituído por uma composição com o caso de
 * uso falso (testes.md, seção 3), sem tocar Supabase real.
 */
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok } from "@/shared/kernel/result";

import { definirDestinoAction, removerDestinoAction } from "./destinos-de-envio.actions";

const definirMock = jest.fn();
const removerMock = jest.fn();

jest.mock("@/main/clientes.factory", () => ({
  makeDefinirDestinoDeEnvio: () => ({ execute: definirMock }),
  makeRemoverDestinoDeEnvio: () => ({ execute: removerMock }),
}));

const CLIENTE_ID = "c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1";
const CONTATO_ID = "d2d2d2d2-d2d2-4d2d-8d2d-d2d2d2d2d2d2";
const VALIDO = { clienteId: CLIENTE_ID, contato: { id: CONTATO_ID }, tipo: "das", canal: "email" };

describe("definirDestinoAction (integração)", () => {
  beforeEach(() => {
    definirMock.mockReset();
    removerMock.mockReset();
  });

  it.each([
    ["Cliente que não é UUID", { clienteId: "abc" }],
    ["contato escolhido que não é UUID", { contato: { id: "x" } }],
    ["canal fora da lista", { canal: "sms" }],
    [
      "contato novo sem WhatsApp nem e-mail",
      { contato: { novo: { nome: "Dora", telefone: "", email: "" } } },
    ],
  ])("%s: VALIDATION_ERROR, sem chamar o caso de uso", async (_nome, parcial) => {
    const resultado = await definirDestinoAction({ ...VALIDO, ...parcial });

    expect(resultado).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });
    expect(definirMock).not.toHaveBeenCalled();
  });

  it("entrada válida chama o caso de uso e devolve os ids", async () => {
    definirMock.mockResolvedValue(ok({ destinoId: "d-1", contatoId: CONTATO_ID }));

    const resultado = await definirDestinoAction(VALIDO);

    expect(definirMock).toHaveBeenCalledWith(VALIDO);
    expect(resultado).toEqual({ ok: true, data: { destinoId: "d-1", contatoId: CONTATO_ID } });
  });

  it("aceita o contato novo", async () => {
    definirMock.mockResolvedValue(ok({ destinoId: "d-1", contatoId: "c-9" }));
    const novo = { nome: "Dora Exemplo", telefone: "11999990000", email: "" };

    const resultado = await definirDestinoAction({
      ...VALIDO,
      contato: { novo },
      canal: "whatsapp",
    });

    expect(resultado.ok).toBe(true);
    expect(definirMock).toHaveBeenCalledWith(expect.objectContaining({ contato: { novo } }));
  });

  it("erro do caso de uso vira ActionResult de falha", async () => {
    definirMock.mockResolvedValue(err(new ForbiddenError("Sem permissão.")));

    const resultado = await definirDestinoAction(VALIDO);

    expect(resultado).toMatchObject({ ok: false, error: { message: "Sem permissão." } });
  });
});

describe("removerDestinoAction (integração)", () => {
  beforeEach(() => removerMock.mockReset());

  it("id que não é UUID: VALIDATION_ERROR, sem chamar o caso de uso", async () => {
    const resultado = await removerDestinoAction({ destinoId: "abc" });

    expect(resultado).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });
    expect(removerMock).not.toHaveBeenCalled();
  });

  it("remove pelo id", async () => {
    removerMock.mockResolvedValue(ok(undefined));

    const resultado = await removerDestinoAction({ destinoId: CONTATO_ID });

    expect(removerMock).toHaveBeenCalledWith({ destinoId: CONTATO_ID });
    expect(resultado.ok).toBe(true);
  });
});
