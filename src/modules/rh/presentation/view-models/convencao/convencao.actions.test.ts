/**
 * Integração presentation ↔ application: o `main` é substituído por uma composição com casos de
 * uso falsos (testes.md, seção 3), sem tocar Supabase.
 */
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok } from "@/shared/kernel/result";

import {
  definirConvencaoDoEmpregadoAction,
  definirInterruptoresAction,
  enviarConvencaoAction,
} from "./convencao.actions";
import { LIMITE_DO_PDF } from "./convencao.schema";

const ID = "11111111-1111-4111-8111-111111111111";

const enviarMock = jest.fn();
const interruptoresMock = jest.fn();
const convencaoDoEmpregadoMock = jest.fn();

jest.mock("@/main/rh.factory", () => ({
  makeEnviarConvencao: async () => ({ execute: enviarMock }),
  makeDefinirInterruptoresDoCliente: async () => ({ execute: interruptoresMock }),
  makeDefinirConvencaoDoEmpregado: async () => ({ execute: convencaoDoEmpregadoMock }),
}));

function formulario(troca: Record<string, string | File> = {}): FormData {
  const dados = new FormData();
  const campos: Record<string, string | File> = {
    clienteId: ID,
    sindicato: " Comércio ",
    vigenciaInicio: "2026-05-01",
    vigenciaFim: "2027-04-30",
    arquivo: new File(["%PDF-1.7"], "cct.pdf", { type: "application/pdf" }),
    ...troca,
  };
  for (const [chave, valor] of Object.entries(campos)) dados.append(chave, valor);
  return dados;
}

describe("convencao.actions (integração)", () => {
  beforeEach(() => {
    for (const caso of [enviarMock, interruptoresMock, convencaoDoEmpregadoMock]) {
      caso.mockReset().mockResolvedValue(ok(undefined));
    }
  });

  describe("enviarConvencaoAction", () => {
    it("entrega os dados e os bytes do PDF ao caso de uso", async () => {
      expect(await enviarConvencaoAction(formulario())).toEqual({ ok: true, data: undefined });

      const entrada = enviarMock.mock.calls[0][0];
      expect(entrada).toMatchObject({
        clienteId: ID,
        sindicato: "Comércio",
        vigenciaInicio: "2026-05-01",
        vigenciaFim: "2027-04-30",
      });
      expect(entrada.arquivo.nome).toBe("cct.pdf");
      expect(Buffer.from(entrada.arquivo.bytes).toString()).toBe("%PDF-1.7");
    });

    it("PDF vazio: recusa com a mensagem do arquivo, sem chamar o caso de uso", async () => {
      const r = await enviarConvencaoAction(formulario({ arquivo: new File([], "vazio.pdf") }));

      expect(r).toEqual({
        ok: false,
        error: { code: "VALIDATION_ERROR", message: "Escolha o PDF da convenção." },
      });
      expect(enviarMock).not.toHaveBeenCalled();
    });

    it("PDF acima do limite da Server Action: recusa", async () => {
      const grande = new File([new Uint8Array(LIMITE_DO_PDF + 1)], "grande.pdf");

      expect(await enviarConvencaoAction(formulario({ arquivo: grande }))).toMatchObject({
        ok: false,
        error: { code: "VALIDATION_ERROR", message: "O PDF passa de 4 MB." },
      });
      expect(enviarMock).not.toHaveBeenCalled();
    });

    it("sindicato vazio: VALIDATION_ERROR com o campo apontado", async () => {
      expect(await enviarConvencaoAction(formulario({ sindicato: "  " }))).toMatchObject({
        ok: false,
        error: { code: "VALIDATION_ERROR", fields: { sindicato: expect.any(Array) } },
      });
      expect(enviarMock).not.toHaveBeenCalled();
    });

    it("devolve o erro do caso de uso (Forbidden)", async () => {
      enviarMock.mockResolvedValue(err(new ForbiddenError("Só o Líder do RH e o Admin enviam.")));

      expect(await enviarConvencaoAction(formulario())).toMatchObject({
        ok: false,
        error: { code: "FORBIDDEN" },
      });
    });
  });

  describe("definirInterruptoresAction", () => {
    it("entrega os dados validados", async () => {
      const input = { clienteId: ID, bancoDeHoras: true, trabalhoAosDomingos: false };

      expect(await definirInterruptoresAction(input)).toEqual({ ok: true, data: undefined });
      expect(interruptoresMock).toHaveBeenCalledWith(input);
    });

    it.each([
      [{ clienteId: ID, bancoDeHoras: true }],
      [{ clienteId: "x", bancoDeHoras: true, trabalhoAosDomingos: true }],
      [undefined],
    ])("%p: VALIDATION_ERROR, sem chamar o caso de uso", async (input) => {
      expect(await definirInterruptoresAction(input)).toMatchObject({
        ok: false,
        error: { code: "VALIDATION_ERROR" },
      });
      expect(interruptoresMock).not.toHaveBeenCalled();
    });
  });

  describe("definirConvencaoDoEmpregadoAction", () => {
    it("aceita sindicato ou nulo e entrega ao caso de uso", async () => {
      expect(
        (await definirConvencaoDoEmpregadoAction({ empregadoId: ID, sindicato: null })).ok,
      ).toBe(true);
      expect(convencaoDoEmpregadoMock).toHaveBeenCalledWith({ empregadoId: ID, sindicato: null });
    });

    it("sindicato vazio: VALIDATION_ERROR, sem chamar o caso de uso", async () => {
      expect(
        await definirConvencaoDoEmpregadoAction({ empregadoId: ID, sindicato: "" }),
      ).toMatchObject({
        ok: false,
        error: { code: "VALIDATION_ERROR" },
      });
      expect(convencaoDoEmpregadoMock).not.toHaveBeenCalled();
    });
  });
});
