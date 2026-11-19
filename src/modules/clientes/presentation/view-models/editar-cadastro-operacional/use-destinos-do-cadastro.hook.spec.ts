import { act, renderHook } from "@testing-library/react";
import { useFieldArray, useForm } from "react-hook-form";

import type { EditarCadastroOperacionalFormValues } from "./editar-cadastro-operacional.schema";
import { useDestinosDoCadastro } from "./use-destinos-do-cadastro.hook";

const definir = jest.fn();
const remover = jest.fn();

jest.mock("./destinos-de-envio.actions", () => ({
  definirDestinoAction: (...a: unknown[]) => definir(...a),
  removerDestinoAction: (...a: unknown[]) => remover(...a),
}));

const ANA = { id: "c-1", nome: "Ana", telefone: "(11) 99999-0000", email: "ana@exemplo.com" };
const BIA = { id: "c-2", nome: "Bia", telefone: "", email: "bia@exemplo.com", donoSetor: "rh" };
const TIPOS = [{ slug: "das", rotulo: "DAS" }];

function montar(
  destinos: { id: string; contatoId: string; tipo: string | null; canal: string }[] = [],
) {
  return renderHook(() => {
    const form = useForm<EditarCadastroOperacionalFormValues>({
      defaultValues: { contatos: [ANA, BIA] } as Partial<EditarCadastroOperacionalFormValues>,
    });
    const { append } = useFieldArray({ control: form.control, name: "contatos" });
    const hook = useDestinosDoCadastro({
      clienteId: "cli-1",
      destinosIniciais: destinos,
      tiposDeEnvio: TIPOS,
      setorDoCadastro: "simples_nacional",
      form,
      adicionarContato: append,
    });
    return { form, hook };
  });
}

describe("useDestinosDoCadastro", () => {
  beforeEach(() => {
    definir.mockReset();
    remover.mockReset();
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it("lista os destinos já gravados, com o contato e o tipo por extenso", () => {
    const { result } = montar([{ id: "d-1", contatoId: "c-1", tipo: "das", canal: "whatsapp" }]);

    expect(result.current.hook.linhas).toMatchObject([
      { id: "d-1", tipo: "DAS", contato: "Ana", canal: "WhatsApp" },
    ]);
    expect(result.current.hook.formulario.opcoesDeContato.map((o) => o.rotulo)).toEqual([
      "(11) 99999-0000",
      "bia@exemplo.com",
    ]);
  });

  it("escolher o contato mostra nome e e-mail; canal único vem preenchido, dois canais pedem escolha", () => {
    const { result } = montar();

    act(() => result.current.hook.onEscolherContato("c-2"));
    expect(result.current.hook.formulario.escolhido).toEqual({
      nome: "Bia",
      email: "bia@exemplo.com",
    });
    expect(result.current.hook.formulario.canal).toBe("email");

    act(() => result.current.hook.onEscolherContato("c-1"));
    expect(result.current.hook.formulario.canal).toBe("");
    expect(result.current.hook.formulario.canais.opcoes).toHaveLength(3);
  });

  it("sem contato ou sem forma de envio escolhida, não chama a action e aponta o campo", async () => {
    const { result } = montar();

    await act(() => result.current.hook.onAdicionar());
    expect(result.current.hook.formulario.erros.contato).toBe("Escolha um contato.");

    act(() => result.current.hook.onEscolherContato("c-1"));
    await act(() => result.current.hook.onAdicionar());
    expect(result.current.hook.formulario.erros.canal).toBe("Escolha a forma de envio.");
    expect(definir).not.toHaveBeenCalled();
  });

  it("adiciona o destino do contato cadastrado: chama a action, entra na tabela e limpa o formulário", async () => {
    definir.mockResolvedValue({ ok: true, data: { destinoId: "d-9", contatoId: "c-2" } });
    const { result } = montar();
    act(() => result.current.hook.onEscolherContato("c-2"));
    act(() => result.current.hook.onMudarTipo("das"));

    await act(() => result.current.hook.onAdicionar());

    expect(definir).toHaveBeenCalledWith({
      clienteId: "cli-1",
      contato: { id: "c-2" },
      tipo: "das",
      canal: "email",
    });
    expect(result.current.hook.linhas).toMatchObject([{ id: "d-9", tipo: "DAS", contato: "Bia" }]);
    expect(result.current.hook.formulario.contatoId).toBe("");
    expect(result.current.hook.aviso?.trim()).toBe("Destino adicionado.");
  });

  it("contato novo: valida, grava e entra na lista de contatos do cadastro (senão o Salvar o apagaria)", async () => {
    definir.mockResolvedValue({ ok: true, data: { destinoId: "d-9", contatoId: "c-novo" } });
    const { result } = montar();
    act(() => result.current.hook.onNovoContato());
    act(() => result.current.hook.onMudarNovo("nome", "Dora"));
    act(() => result.current.hook.onMudarNovo("telefone", "(11) 97777-0000"));

    await act(() => result.current.hook.onAdicionar());

    expect(definir).toHaveBeenCalledWith({
      clienteId: "cli-1",
      contato: { novo: { nome: "Dora", telefone: "(11) 97777-0000", email: "" } },
      tipo: null,
      canal: "whatsapp",
    });
    expect(result.current.form.getValues("contatos")).toHaveLength(3);
    expect(result.current.form.getValues("contatos.2")).toMatchObject({
      id: "c-novo",
      nome: "Dora",
      donoSetor: "simples_nacional",
    });
    expect(result.current.hook.formulario.modo).toBe("existente");
  });

  it("contato novo inválido marca os campos e não chama a action", async () => {
    const { result } = montar();
    act(() => result.current.hook.onNovoContato());

    await act(() => result.current.hook.onAdicionar());

    expect(result.current.hook.formulario.erros.nome).toBe("obrigatório");
    expect(definir).not.toHaveBeenCalled();
  });

  it("ao digitar número já existente no Cliente mostra o contato existente e barra o repetido", async () => {
    const { result } = montar();
    act(() => result.current.hook.onNovoContato());
    act(() => result.current.hook.onMudarNovo("nome", "Outra"));
    act(() => result.current.hook.onMudarNovo("telefone", "11999990000"));

    expect(result.current.hook.formulario.repetido).toEqual({ id: "c-1", nome: "Ana" });
    await act(() => result.current.hook.onAdicionar());
    expect(definir).not.toHaveBeenCalled();
    expect(result.current.hook.formulario.erros.contato).toContain("Ana");

    act(() => result.current.hook.onUsarExistente("c-1"));
    expect(result.current.hook.formulario.modo).toBe("existente");
    expect(result.current.hook.formulario.contatoId).toBe("c-1");
  });

  it("falha da action aparece no formulário e nada entra na tabela", async () => {
    definir.mockResolvedValue({ ok: false, error: { code: "X", message: "Sem permissão." } });
    const { result } = montar();
    act(() => result.current.hook.onEscolherContato("c-2"));

    await act(() => result.current.hook.onAdicionar());

    expect(result.current.hook.formulario.erroGeral).toBe("Sem permissão.");
    expect(result.current.hook.linhas).toEqual([]);
    expect(result.current.hook.formulario.pendente).toBe(false);
  });

  it("remove o destino: chama a action, sai da tabela e anuncia", async () => {
    remover.mockResolvedValue({ ok: true, data: undefined });
    const { result } = montar([{ id: "d-1", contatoId: "c-1", tipo: null, canal: "whatsapp" }]);

    await act(() => result.current.hook.onRemover("d-1"));

    expect(remover).toHaveBeenCalledWith({ destinoId: "d-1" });
    expect(result.current.hook.linhas).toEqual([]);
    expect(result.current.hook.aviso?.trim()).toBe("Destino removido.");
  });

  it("falha ao remover mantém o destino e mostra o erro", async () => {
    remover.mockResolvedValue({ ok: false, error: { code: "X", message: "Não removido." } });
    const { result } = montar([{ id: "d-1", contatoId: "c-1", tipo: null, canal: "whatsapp" }]);

    await act(() => result.current.hook.onRemover("d-1"));

    expect(result.current.hook.linhas).toHaveLength(1);
    expect(result.current.hook.formulario.erroGeral).toBe("Não removido.");
  });

  it("falha de transporte vira mensagem, sem derrubar a tela", async () => {
    definir.mockRejectedValue(new Error("rede"));
    const { result } = montar();
    act(() => result.current.hook.onEscolherContato("c-2"));

    await act(() => result.current.hook.onAdicionar());

    expect(result.current.hook.formulario.erroGeral).toBeTruthy();
    expect(result.current.hook.formulario.pendente).toBe(false);
  });
});
