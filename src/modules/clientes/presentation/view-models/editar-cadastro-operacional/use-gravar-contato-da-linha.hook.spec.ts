import { renderHook } from "@testing-library/react";

import type { ValoresDaLinha } from "./contato-da-linha.presenter";
import { useGravarContatoDaLinha } from "./use-gravar-contato-da-linha.hook";

const salvarContato = jest.fn();
const definirTipos = jest.fn();

jest.mock("./salvar-contato.actions", () => ({
  salvarContatoAction: (...a: unknown[]) => salvarContato(...a),
}));
jest.mock("./tipos-de-envio.actions", () => ({
  definirTiposDoContatoAction: (...a: unknown[]) => definirTipos(...a),
}));

const CONTATO: ValoresDaLinha = {
  id: "c-1",
  nome: "Ana",
  telefone: "(11) 99999-0000",
  email: "ana@exemplo.com",
  tipos: [],
  canal: "",
};

const gravar = () => renderHook(() => useGravarContatoDaLinha("cli-1")).result.current;

describe("useGravarContatoDaLinha", () => {
  beforeEach(() => {
    salvarContato.mockReset();
    definirTipos.mockReset();
  });

  it("grava o contato e depois os envios, com o id devolvido pelo servidor", async () => {
    salvarContato.mockResolvedValue({ ok: true, data: { id: "c-9" } });
    definirTipos.mockResolvedValue({ ok: true, data: undefined });

    const r = await gravar()({
      contato: { ...CONTATO, id: undefined },
      gravarCampos: true,
      gravarEnvios: true,
      tipos: ["das"],
      canal: "whatsapp",
    });

    expect(salvarContato).toHaveBeenCalledWith({
      clienteId: "cli-1",
      contato: {
        id: undefined,
        nome: "Ana",
        telefone: "(11) 99999-0000",
        email: "ana@exemplo.com",
      },
    });
    expect(definirTipos).toHaveBeenCalledWith({
      clienteId: "cli-1",
      contatoId: "c-9",
      tipos: ["das"],
      canal: "whatsapp",
    });
    expect(r).toEqual({ id: "c-9", camposGravados: true });
  });

  it("só os envios mudaram: não chama a gravação do contato", async () => {
    definirTipos.mockResolvedValue({ ok: true, data: undefined });

    const r = await gravar()({
      contato: CONTATO,
      gravarCampos: false,
      gravarEnvios: true,
      tipos: [],
    });

    expect(salvarContato).not.toHaveBeenCalled();
    expect(r).toEqual({ id: "c-1", camposGravados: false });
  });

  it("falha ao gravar o contato: volta dita e os envios nem são tentados", async () => {
    salvarContato.mockResolvedValue({ ok: false, error: { message: "Número inválido." } });

    const r = await gravar()({
      contato: CONTATO,
      gravarCampos: true,
      gravarEnvios: true,
      tipos: ["das"],
    });

    expect(definirTipos).not.toHaveBeenCalled();
    expect(r).toEqual({ id: "c-1", camposGravados: false, falha: "Número inválido." });
  });

  it("falha nos envios depois de o contato gravado: diz que o contato ficou", async () => {
    salvarContato.mockResolvedValue({ ok: true, data: { id: "c-1" } });
    definirTipos.mockResolvedValue({ ok: false, error: { message: "Sem permissão." } });

    const r = await gravar()({
      contato: CONTATO,
      gravarCampos: true,
      gravarEnvios: true,
      tipos: ["das"],
    });

    expect(r).toEqual({
      id: "c-1",
      camposGravados: true,
      falha: "Contato salvo, mas os envios não: Sem permissão.",
    });
  });

  it("falha nos envios sozinhos: a mensagem vem sem o prefixo", async () => {
    definirTipos.mockResolvedValue({ ok: false, error: { message: "Sem permissão." } });

    const r = await gravar()({
      contato: CONTATO,
      gravarCampos: false,
      gravarEnvios: true,
      tipos: ["das"],
    });

    expect(r).toEqual({ id: "c-1", camposGravados: false, falha: "Sem permissão." });
  });
});
