/**
 * Integração presentation ↔ application: o `main` é substituído por uma composição com portas
 * OUT falsas (testes.md, seção 3), sem tocar Supabase real.
 */
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok } from "@/shared/kernel/result";

import {
  buscarClienteParaContatoUraAction,
  cadastrarContatoUraAction,
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
const buscarClienteMock = jest.fn();
const cadastrarContatoMock = jest.fn();

jest.mock("@/main/atendimento.factory", () => ({
  makeObterConversa: async () => ({ execute: obterMock }),
  makeEnviarDocumentoAoCliente: async () => ({ execute: enviarMock }),
  makeTransferirAtendimento: async () => ({ execute: transferirMock }),
  makeEnviarMensagemAoCliente: async () => ({ execute: mensagemMock }),
  makeEncerrarAtendimento: async () => ({ execute: encerrarMock }),
  makeBuscarClienteParaContatoUra: async () => ({ execute: buscarClienteMock }),
  makeCadastrarContatoUra: async () => ({ execute: cadastrarContatoMock }),
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
    const entrada = { atendimentoId: ID, documento: { tipo: "alteracao", numero: 3 } };
    const r = await enviarDocumentoAction(entrada);
    expect(r.ok).toBe(true);
    expect(enviarMock).toHaveBeenCalledWith(entrada);
  });

  it("devolve VALIDATION_ERROR sem chamar o caso de uso quando o documento é inválido", async () => {
    const r = await enviarDocumentoAction({
      atendimentoId: ID,
      documento: { tipo: "alteracao", numero: null },
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

  it("chama o caso de uso e devolve o resultado", async () => {
    encerrarMock.mockResolvedValue(ok(undefined));

    const r = await encerrarAtendimentoAction(ID);

    expect(r).toEqual({ ok: true, data: undefined });
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

describe("buscarClienteParaContatoUraAction (integração)", () => {
  beforeEach(() => buscarClienteMock.mockReset());

  it("devolve o Cliente do CNPJ para a Recepção confirmar", async () => {
    const cliente = { id: ID, empresa: "Padaria Ltda", cnpj: "11444777000161" };
    buscarClienteMock.mockResolvedValue(ok(cliente));

    const r = await buscarClienteParaContatoUraAction({
      atendimentoId: ID,
      cnpj: "11.444.777/0001-61",
    });

    expect(r).toEqual({ ok: true, data: cliente });
    expect(buscarClienteMock).toHaveBeenCalledWith({
      atendimentoId: ID,
      cnpj: "11.444.777/0001-61",
    });
  });

  it("repassa a negativa de quem não é o dono do Atendimento", async () => {
    buscarClienteMock.mockResolvedValue(err(new ForbiddenError("Só o dono busca o Cliente.")));

    const r = await buscarClienteParaContatoUraAction({
      atendimentoId: ID,
      cnpj: "11444777000161",
    });

    expect(!r.ok && r.error.code).toBe("FORBIDDEN");
  });

  it.each([
    [{ atendimentoId: "1", cnpj: "11444777000161" }],
    [{ atendimentoId: ID, cnpj: "" }],
    [{ atendimentoId: ID, cnpj: "1234567890123456789" }],
    [undefined],
  ])("devolve VALIDATION_ERROR sem chamar o caso de uso quando a entrada é %p", async (entrada) => {
    const r = await buscarClienteParaContatoUraAction(entrada);

    expect(!r.ok && r.error.code).toBe("VALIDATION_ERROR");
    expect(buscarClienteMock).not.toHaveBeenCalled();
  });
});

describe("cadastrarContatoUraAction (integração)", () => {
  beforeEach(() => cadastrarContatoMock.mockReset());
  const CLIENTE = "5b0b6c58-1c5e-4f0e-9d3c-7a8a1f2f3a4b";

  it("cadastra com o e-mail em branco como null", async () => {
    cadastrarContatoMock.mockResolvedValue(
      ok({ status: "criado", contatoId: "ct-1", nome: "Maria" }),
    );

    const r = await cadastrarContatoUraAction({
      atendimentoId: ID,
      clienteId: CLIENTE,
      nome: " Maria ",
      email: "",
    });

    expect(r).toEqual({ ok: true, data: { status: "criado", contatoId: "ct-1", nome: "Maria" } });
    expect(cadastrarContatoMock).toHaveBeenCalledWith({
      atendimentoId: ID,
      clienteId: CLIENTE,
      nome: "Maria",
      email: null,
    });
  });

  it("repassa a negativa do caso de uso", async () => {
    cadastrarContatoMock.mockResolvedValue(err(new ForbiddenError("Só o dono cadastra.")));

    const r = await cadastrarContatoUraAction({
      atendimentoId: ID,
      clienteId: CLIENTE,
      nome: "Maria",
      email: "maria@padaria-ura.teste",
    });

    expect(!r.ok && r.error.code).toBe("FORBIDDEN");
  });

  it.each([
    [{ atendimentoId: ID, clienteId: "nao-e-guid", nome: "Maria", email: "" }],
    [{ atendimentoId: ID, clienteId: CLIENTE, nome: "   ", email: "" }],
    [{ atendimentoId: ID, clienteId: CLIENTE, nome: "A".repeat(121), email: "" }],
    [{ atendimentoId: ID, clienteId: CLIENTE, nome: "Maria", email: "abc" }],
    [undefined],
  ])("devolve VALIDATION_ERROR sem chamar o caso de uso quando a entrada é %p", async (entrada) => {
    const r = await cadastrarContatoUraAction(entrada);

    expect(!r.ok && r.error.code).toBe("VALIDATION_ERROR");
    expect(cadastrarContatoMock).not.toHaveBeenCalled();
  });
});
