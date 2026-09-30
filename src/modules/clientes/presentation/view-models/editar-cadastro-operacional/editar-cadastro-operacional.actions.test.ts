/**
 * Integração presentation ↔ application: o `main` é substituído por uma
 * composição com portas OUT falsas (testes.md, seção 3), sem tocar Supabase real.
 */
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok } from "@/shared/kernel/result";

import { editarCadastroOperacionalAction } from "./editar-cadastro-operacional.actions";

const executeMock = jest.fn();

jest.mock("@/main/clientes.factory", () => ({
  makeEditarCadastroOperacionalCliente: () => ({ execute: executeMock }),
}));

const CLIENTE_ID = "123e4567-e89b-42d3-a456-426614174000";

const INPUT_VALIDO = {
  clienteId: CLIENTE_ID,
  formaEnvio: "whatsapp",
  contatos: [{ nome: "Maria", telefone: "11999998888", padrao: true }],
  documentoObrigatorio: "positivo",
  dasStatus: "pronto",
  dataEnvioDas: "2026-02-01",
  temParcelamento: false,
  parcelamentoStatus: null,
  observacoesGerais: "",
  atividadeMes: { industria: false, comercio: true, servico: false },
};

describe("editarCadastroOperacionalAction (integração)", () => {
  beforeEach(() => executeMock.mockReset());

  it("devolve VALIDATION_ERROR sem chamar o caso de uso quando o input é inválido", async () => {
    const resultado = await editarCadastroOperacionalAction({
      ...INPUT_VALIDO,
      clienteId: "não-e-uuid",
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error.code).toBe("VALIDATION_ERROR");
    expect(executeMock).not.toHaveBeenCalled();
  });

  it("devolve o ActionResult de sucesso do caso de uso quando o input é válido", async () => {
    executeMock.mockResolvedValue(ok({ clienteId: CLIENTE_ID }));

    const resultado = await editarCadastroOperacionalAction(INPUT_VALIDO);

    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.data.clienteId).toBe(CLIENTE_ID);
  });

  it("devolve o ActionResult de erro do caso de uso (ex.: Forbidden)", async () => {
    executeMock.mockResolvedValue(
      err(new ForbiddenError("Só Admin ou Funcionário do Simples Nacional edita.")),
    );

    const resultado = await editarCadastroOperacionalAction(INPUT_VALIDO);

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error.code).toBe("FORBIDDEN");
  });
});
