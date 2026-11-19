import { act, renderHook } from "@testing-library/react";
import { useForm } from "react-hook-form";

import type { EditarCadastroOperacionalFormValues } from "./editar-cadastro-operacional.schema";
import { useContatosDaLinha } from "./use-contatos-da-linha.hook";

const salvarContato = jest.fn();

jest.mock("./salvar-contato.actions", () => ({
  salvarContatoAction: (...a: unknown[]) => salvarContato(...a),
}));

const NOVO = { nome: "Maria Exemplo", telefone: "(11) 99999-0000", email: "" };

function montar(contatos: { id?: string; nome: string; telefone: string; email: string }[]) {
  return renderHook(() => {
    const form = useForm<EditarCadastroOperacionalFormValues>({
      defaultValues: { contatos } as Partial<EditarCadastroOperacionalFormValues>,
    });
    const linhas = useContatosDaLinha({ clienteId: "c1", form });
    return { form, linhas, erros: form.formState.errors };
  });
}

describe("useContatosDaLinha", () => {
  beforeEach(() => {
    salvarContato.mockReset();
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it("marca como salva só a linha com id", () => {
    const { result } = montar([{ id: "x", ...NOVO }, NOVO]);

    expect(result.current.linhas.salvos).toEqual([true, false]);
  });

  it("contato inválido marca o campo e não chama a action", async () => {
    const { result } = montar([{ nome: "", telefone: "", email: "" }]);

    await act(() => result.current.linhas.onSalvar(0));

    expect(salvarContato).not.toHaveBeenCalled();
    expect(result.current.erros.contatos?.[0]?.nome?.message).toBe("obrigatório");
  });

  it("salva: grava o id na linha, anuncia e devolve o foco ao Nome", async () => {
    salvarContato.mockResolvedValue({ ok: true, data: { id: "novo-id" } });
    const nome = document.body.appendChild(document.createElement("input"));
    nome.id = "contatos.0.nome";
    const { result } = montar([NOVO]);

    await act(() => result.current.linhas.onSalvar(0));

    expect(salvarContato).toHaveBeenCalledWith({ clienteId: "c1", contato: NOVO });
    expect(result.current.form.getValues("contatos.0.id")).toBe("novo-id");
    expect(result.current.linhas.salvos).toEqual([true]);
    expect(result.current.linhas.aviso?.trim()).toBe("Contato 1 salvo.");
    expect(result.current.linhas.salvando).toBeNull();
    expect(nome).toHaveFocus();
    nome.remove();
  });

  it("falha devolvida pela action aparece só na linha que falhou", async () => {
    salvarContato.mockResolvedValue({ ok: false, error: { code: "X", message: "Já existe." } });
    const { result } = montar([NOVO, NOVO]);

    await act(() => result.current.linhas.onSalvar(1));

    expect(result.current.linhas.erroDaLinha(1)).toBe("Já existe.");
    expect(result.current.linhas.erroDaLinha(0)).toBeUndefined();
    expect(result.current.linhas.salvando).toBeNull();
  });

  it("action que rejeita vira mensagem na linha e solta o salvando", async () => {
    salvarContato.mockRejectedValue(new Error("falha de rede"));
    const { result } = montar([NOVO]);

    await act(() => result.current.linhas.onSalvar(0));

    expect(result.current.linhas.erroDaLinha(0)).toEqual(expect.any(String));
    expect(result.current.linhas.salvando).toBeNull();
  });

  it("não reentra: segundo Salvar com o primeiro pendente não chama a action de novo", async () => {
    let concluir: (valor: unknown) => void = () => undefined;
    salvarContato.mockReturnValue(new Promise((resolve) => (concluir = resolve)));
    const { result } = montar([NOVO]);

    let primeiro: Promise<void> = Promise.resolve();
    act(() => {
      primeiro = result.current.linhas.onSalvar(0);
    });
    await act(() => result.current.linhas.onSalvar(0));
    await act(async () => {
      concluir({ ok: true, data: { id: "id" } });
      await primeiro;
    });

    expect(salvarContato).toHaveBeenCalledTimes(1);
  });

  it("limpar volta a linha ao padrão, anuncia e não chama a action", () => {
    const { result } = montar([{ id: undefined, ...NOVO }]);

    act(() => result.current.linhas.onLimpar(0));

    expect(result.current.form.getValues("contatos.0")).toMatchObject({
      nome: "",
      telefone: "",
      email: "",
    });
    expect(result.current.linhas.aviso?.trim()).toBe("Contato 1 limpo.");
    expect(salvarContato).not.toHaveBeenCalled();
  });

  it("repetir a mesma ação muda o texto do aviso para o leitor de tela anunciar de novo", () => {
    const { result } = montar([NOVO]);

    act(() => result.current.linhas.onLimpar(0));
    const primeiro = result.current.linhas.aviso;
    act(() => result.current.linhas.onLimpar(0));
    const segundo = result.current.linhas.aviso;

    expect(segundo).not.toBe(primeiro);
    expect(segundo?.trim()).toBe(primeiro?.trim());
  });
});
