/**
 * Integração presentation ↔ application: o `main` é substituído por uma composição com portas
 * OUT falsas (testes.md, seção 3), sem tocar Supabase real.
 */
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok } from "@/shared/kernel/result";

import {
  encerrarAtendimentoAction,
  enviarDocumentoAction,
  enviarMensagemAction,
  obterConversaAction,
  transferirAtendimentoAction,
} from "./conversa.actions";

const obterMock = jest.fn();
const enviarMock = jest.fn();
const transferirMock = jest.fn();
const mensagemMock = jest.fn();
const encerrarMock = jest.fn();

jest.mock("@/main/atendimento.factory", () => ({
  makeObterConversa: async () => ({ execute: obterMock }),
  makeEnviarDocumentoAoCliente: async () => ({ execute: enviarMock }),
  makeTransferirAtendimento: async () => ({ execute: transferirMock }),
  makeEnviarMensagemAoCliente: async () => ({ execute: mensagemMock }),
  makeEncerrarAtendimento: async () => ({ execute: encerrarMock }),
}));

const ID = "9f1c9c6e-9d1a-4c9a-8b1e-2e2a4a5b6c7d";

describe("obterConversaAction (integração)", () => {
  beforeEach(() => obterMock.mockReset());

  it("devolve a conversa do caso de uso", async () => {
    obterMock.mockResolvedValue(ok({ atendimentoId: ID }));
    const r = await obterConversaAction(ID);
    expect(r).toEqual({ ok: true, data: { atendimentoId: ID } });
    expect(obterMock).toHaveBeenCalledWith({ atendimentoId: ID });
  });

  it("repassa a negativa do caso de uso", async () => {
    obterMock.mockResolvedValue(err(new ForbiddenError("Você não pode ver este Atendimento.")));
    const r = await obterConversaAction(ID);
    expect(!r.ok && r.error.code).toBe("FORBIDDEN");
  });

  it.each([["1"], [""], [undefined]])(
    "devolve VALIDATION_ERROR sem chamar o caso de uso quando o id é %p",
    async (entrada) => {
      const r = await obterConversaAction(entrada);
      expect(!r.ok && r.error.code).toBe("VALIDATION_ERROR");
      expect(obterMock).not.toHaveBeenCalled();
    },
  );
});

describe("enviarDocumentoAction (integração)", () => {
  beforeEach(() => enviarMock.mockReset());

  it("chama o caso de uso com o documento escolhido", async () => {
    enviarMock.mockResolvedValue(ok(undefined));
    const entrada = { atendimentoId: ID, documento: { tipo: "alteracao", data: "2026-03-01" } };
    const r = await enviarDocumentoAction(entrada);
    expect(r.ok).toBe(true);
    expect(enviarMock).toHaveBeenCalledWith(entrada);
  });

  it("devolve VALIDATION_ERROR sem chamar o caso de uso quando o documento é inválido", async () => {
    const r = await enviarDocumentoAction({
      atendimentoId: ID,
      documento: { tipo: "alteracao", data: null },
    });
    expect(!r.ok && r.error.code).toBe("VALIDATION_ERROR");
    expect(enviarMock).not.toHaveBeenCalled();
  });
});

describe("transferirAtendimentoAction (integração)", () => {
  beforeEach(() => transferirMock.mockReset());

  it("chama o caso de uso com o Setor e o resumo", async () => {
    transferirMock.mockResolvedValue(ok({ destinatarioNome: "Ana" }));
    const entrada = { atendimentoId: ID, setorDestino: "tributario", resumo: "DAS em atraso" };

    const r = await transferirAtendimentoAction(entrada);

    expect(r).toEqual({ ok: true, data: { destinatarioNome: "Ana" } });
    expect(transferirMock).toHaveBeenCalledWith(entrada);
  });

  it("devolve VALIDATION_ERROR sem chamar o caso de uso quando falta o resumo", async () => {
    const r = await transferirAtendimentoAction({
      atendimentoId: ID,
      setorDestino: "tributario",
      resumo: " ",
    });

    expect(!r.ok && r.error.code).toBe("VALIDATION_ERROR");
    expect(transferirMock).not.toHaveBeenCalled();
  });
});

describe("enviarMensagemAction (integração)", () => {
  beforeEach(() => mensagemMock.mockReset());

  it("chama o caso de uso com o texto", async () => {
    mensagemMock.mockResolvedValue(ok(undefined));

    const r = await enviarMensagemAction({ atendimentoId: ID, texto: "Bom dia" });

    expect(r.ok).toBe(true);
    expect(mensagemMock).toHaveBeenCalledWith({ atendimentoId: ID, texto: "Bom dia" });
  });

  it("devolve VALIDATION_ERROR sem chamar o caso de uso quando o texto é vazio", async () => {
    const r = await enviarMensagemAction({ atendimentoId: ID, texto: "  " });

    expect(!r.ok && r.error.code).toBe("VALIDATION_ERROR");
    expect(mensagemMock).not.toHaveBeenCalled();
  });
});

describe("encerrarAtendimentoAction (integração)", () => {
  beforeEach(() => encerrarMock.mockReset());

  it("chama o caso de uso e devolve o próximo da Fila que o Funcionário assumiu", async () => {
    encerrarMock.mockResolvedValue(ok({ proximoDaFila: "at-9" }));

    const r = await encerrarAtendimentoAction(ID);

    expect(r).toEqual({ ok: true, data: { proximoDaFila: "at-9" } });
    expect(encerrarMock).toHaveBeenCalledWith({ atendimentoId: ID });
  });

  it("repassa a negativa de quem não pode encerrar", async () => {
    encerrarMock.mockResolvedValue(
      err(new ForbiddenError("Você não pode encerrar este Atendimento.")),
    );

    const r = await encerrarAtendimentoAction(ID);

    expect(!r.ok && r.error.code).toBe("FORBIDDEN");
  });

  it("devolve VALIDATION_ERROR sem chamar o caso de uso quando o id é inválido", async () => {
    const r = await encerrarAtendimentoAction("1");

    expect(!r.ok && r.error.code).toBe("VALIDATION_ERROR");
    expect(encerrarMock).not.toHaveBeenCalled();
  });
});
