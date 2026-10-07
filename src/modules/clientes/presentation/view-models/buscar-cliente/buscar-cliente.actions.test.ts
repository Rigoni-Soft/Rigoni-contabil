/**
 * Integração presentation ↔ application: o `main` é substituído por uma
 * composição com portas OUT falsas (testes.md, seção 3), sem tocar Supabase real.
 */
import { ok } from "@/shared/kernel/result";

import { buscarClientesAction, carregarCadastroOperacionalAction } from "./buscar-cliente.actions";

const buscarExecuteMock = jest.fn();
const consultarExecuteMock = jest.fn();

jest.mock("@/main/clientes.factory", () => ({
  makeBuscarClientes: () => ({ execute: buscarExecuteMock }),
  makeConsultarCadastroOperacionalCliente: () => ({ execute: consultarExecuteMock }),
}));

describe("buscarClientesAction (integração)", () => {
  beforeEach(() => buscarExecuteMock.mockReset());

  it("devolve VALIDATION_ERROR sem chamar o caso de uso quando o termo tem menos de 3 caracteres", async () => {
    const resultado = await buscarClientesAction({ termo: "Pã" });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error.code).toBe("VALIDATION_ERROR");
    expect(buscarExecuteMock).not.toHaveBeenCalled();
  });

  it("devolve as sugestões do caso de uso quando o termo é válido", async () => {
    const sugestoes = [{ id: "1", empresa: "Padaria Pão Quente Ltda", cnpj: "11444777000161" }];
    buscarExecuteMock.mockResolvedValue(ok(sugestoes));

    const resultado = await buscarClientesAction({ termo: "Pão", apenasSnMei: true });

    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.data).toEqual(sugestoes);
    expect(buscarExecuteMock).toHaveBeenCalledWith("Pão", true);
  });
});

describe("carregarCadastroOperacionalAction (integração)", () => {
  beforeEach(() => consultarExecuteMock.mockReset());

  it("devolve o cadastro operacional do cliente selecionado", async () => {
    const id = "9f1c9c6e-9d1a-4c9a-8b1e-2e2a4a5b6c7d";
    consultarExecuteMock.mockResolvedValue(ok({ id, empresa: "Padaria Pão Quente Ltda" }));

    const resultado = await carregarCadastroOperacionalAction(id);

    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.data).toEqual({ id, empresa: "Padaria Pão Quente Ltda" });
    expect(consultarExecuteMock).toHaveBeenCalledWith(id);
  });

  it.each([["1"], [""], [undefined], [{ id: "x" }]])(
    "devolve VALIDATION_ERROR sem chamar o caso de uso quando o clienteId é %p",
    async (entrada) => {
      const resultado = await carregarCadastroOperacionalAction(entrada);

      expect(!resultado.ok && resultado.error.code).toBe("VALIDATION_ERROR");
      expect(consultarExecuteMock).not.toHaveBeenCalled();
    },
  );
});
