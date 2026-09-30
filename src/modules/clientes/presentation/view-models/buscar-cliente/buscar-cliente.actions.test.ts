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

    const resultado = await buscarClientesAction({ termo: "Pão" });

    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.data).toEqual(sugestoes);
    expect(buscarExecuteMock).toHaveBeenCalledWith("Pão");
  });
});

describe("carregarCadastroOperacionalAction (integração)", () => {
  beforeEach(() => consultarExecuteMock.mockReset());

  it("devolve o cadastro operacional do cliente selecionado", async () => {
    consultarExecuteMock.mockResolvedValue(ok({ id: "1", empresa: "Padaria Pão Quente Ltda" }));

    const resultado = await carregarCadastroOperacionalAction("1");

    expect(resultado.ok).toBe(true);
    if (resultado.ok)
      expect(resultado.data).toEqual({ id: "1", empresa: "Padaria Pão Quente Ltda" });
    expect(consultarExecuteMock).toHaveBeenCalledWith("1");
  });
});
