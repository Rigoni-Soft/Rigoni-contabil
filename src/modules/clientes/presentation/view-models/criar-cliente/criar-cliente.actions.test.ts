/**
 * Integração presentation ↔ application: o `main` é substituído por uma
 * composição com portas OUT falsas (testes.md, seção 3), sem tocar Supabase real.
 */
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok } from "@/shared/kernel/result";

import { criarClienteAction } from "./criar-cliente.actions";

const executeMock = jest.fn();

jest.mock("@/main/clientes.factory", () => ({
  makeCriarCliente: () => ({ execute: executeMock }),
}));

function arquivo(): File {
  return new File(["conteúdo"], "doc.pdf", { type: "application/pdf" });
}

const INPUT_VALIDO = {
  empresa: "Padaria Pão Quente Ltda",
  cnpj: "11.444.777/0001-61",
  regime: "simples_nacional",
  contratoSocial: arquivo(),
  alteracoesContratuais: [],
};

describe("criarClienteAction (integração)", () => {
  beforeEach(() => executeMock.mockReset());

  it("devolve VALIDATION_ERROR sem chamar o caso de uso quando o input é inválido", async () => {
    const resultado = await criarClienteAction({
      empresa: "",
      cnpj: "",
      regime: "lucro_arbitrado",
      contratoSocial: undefined,
      alteracoesContratuais: [],
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error.code).toBe("VALIDATION_ERROR");
    expect(executeMock).not.toHaveBeenCalled();
  });

  it("devolve o ActionResult de sucesso do caso de uso quando o input é válido", async () => {
    executeMock.mockResolvedValue(
      ok({
        cliente: {
          id: "1",
          empresa: "Padaria Pão Quente Ltda",
          cnpj: "11444777000161",
          regime: "simples_nacional",
          contratoSocialCaminho: "1/contrato-social/doc.pdf",
          alteracoesContratuais: [],
        },
      }),
    );

    const resultado = await criarClienteAction(INPUT_VALIDO);

    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.data.cliente.cnpj).toBe("11444777000161");
  });

  it("devolve o ActionResult de erro do caso de uso (ex.: Forbidden)", async () => {
    executeMock.mockResolvedValue(err(new ForbiddenError("Só Admin cadastra Cliente.")));

    const resultado = await criarClienteAction(INPUT_VALIDO);

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error.code).toBe("FORBIDDEN");
  });
});
