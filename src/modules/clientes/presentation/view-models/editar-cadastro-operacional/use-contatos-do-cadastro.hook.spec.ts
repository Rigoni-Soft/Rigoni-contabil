import { act, renderHook } from "@testing-library/react";
import { useFieldArray, useForm } from "react-hook-form";

import type { EditarCadastroOperacionalFormValues } from "./editar-cadastro-operacional.schema";
import { useContatosDoCadastro } from "./use-contatos-do-cadastro.hook";

const salvarContato = jest.fn();
const definirTipos = jest.fn();

jest.mock("./salvar-contato.actions", () => ({
  salvarContatoAction: (...a: unknown[]) => salvarContato(...a),
}));
jest.mock("./tipos-de-envio.actions", () => ({
  definirTiposDoContatoAction: (...a: unknown[]) => definirTipos(...a),
}));

const ANA = {
  id: "c-1",
  nome: "Ana",
  telefone: "(11) 99999-0000",
  email: "ana@exemplo.com",
  donoSetor: "simples_nacional",
  tipos: ["das"],
  // Ana tem os dois canais: o Setor já escolheu por onde enviar.
  canal: "whatsapp",
};
const BIA = {
  id: "c-2",
  nome: "Bia",
  telefone: "",
  email: "bia@exemplo.com",
  donoSetor: "rh",
  tipos: [],
  canal: "",
};
const NOVA = {
  nome: "Nova",
  telefone: "(11) 98888-0000",
  email: "",
  tipos: [] as string[],
  canal: "",
};
const TIPOS = [
  { slug: "das", rotulo: "DAS" },
  { slug: "avisos", rotulo: "Avisos" },
];

type Contato =
  | typeof ANA
  | typeof BIA
  | typeof NOVA
  | { nome: string; telefone: string; email: string; tipos: string[] };

function montar(
  contatos: Contato[] = [ANA, BIA, NOVA],
  admin = false,
  destinos = [{ contatoId: "c-1", tipo: "das", canal: "whatsapp" }],
) {
  return renderHook(() => {
    const form = useForm<EditarCadastroOperacionalFormValues>({
      defaultValues: { contatos } as Partial<EditarCadastroOperacionalFormValues>,
    });
    const { fields, remove } = useFieldArray({ control: form.control, name: "contatos" });
    const linhas = useContatosDoCadastro({
      clienteId: "cli-1",
      form,
      campos: fields,
      remover: remove,
      destinos,
      tiposDeEnvio: TIPOS,
      setorDoCadastro: "simples_nacional",
      admin,
      verTodos: admin,
    });
    return { form, linhas, erros: form.formState.errors, fields };
  });
}

describe("useContatosDoCadastro", () => {
  beforeEach(() => {
    salvarContato.mockReset();
    definirTipos.mockReset();
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it("linha salva abre só mostrando; linha nova já nasce em edição", () => {
    const { result } = montar();

    expect([0, 1, 2].map(result.current.linhas.editando)).toEqual([false, false, true]);
    expect([0, 1, 2].map(result.current.linhas.salvo)).toEqual([true, true, false]);
  });

  it("contato de outro Setor tem os campos travados e só se deixa de usar; o do Setor se remove", () => {
    const { result } = montar();

    expect(result.current.linhas.camposTravados(0)).toBe(false);
    expect(result.current.linhas.camposTravados(1)).toBe(true);
    expect(result.current.linhas.rotuloDaLixeira(1)).toMatch(/^Deixar de usar/);
  });

  it("a lixeira do contato de outro Setor só pergunta: nada é chamado até confirmar, e Manter fecha a pergunta", () => {
    const { result } = montar();

    expect(result.current.linhas.confirmacaoDeRemocao(1)).toBeUndefined();
    act(() => result.current.linhas.onRemover(1));
    expect(result.current.linhas.confirmacaoDeRemocao(1)?.texto).toMatch(/^Deixar de usar/);
    expect(definirTipos).not.toHaveBeenCalled();
    act(() => result.current.linhas.confirmacaoDeRemocao(1)?.onCancelar());

    expect(result.current.linhas.confirmacaoDeRemocao(1)).toBeUndefined();
    expect(definirTipos).not.toHaveBeenCalled();
  });

  it("confirmar o deixar de usar tira os envios do Setor e fecha a pergunta", async () => {
    definirTipos.mockResolvedValue({ ok: true, data: undefined });
    const { result } = montar();

    act(() => result.current.linhas.onRemover(1));
    await act(async () => result.current.linhas.confirmacaoDeRemocao(1)?.onConfirmar());

    expect(definirTipos).toHaveBeenCalledWith({ clienteId: "cli-1", contatoId: "c-2", tipos: [] });
    expect(result.current.linhas.confirmacaoDeRemocao(1)).toBeUndefined();
    expect(result.current.linhas.erroDaLinha(1)).toBeUndefined();
  });

  it("o Admin edita e remove qualquer contato e não tem checkboxes de envio", () => {
    const { result } = montar([ANA, BIA], true);

    expect(result.current.linhas.camposTravados(1)).toBe(false);
    expect(result.current.linhas.envios(0)).toBeUndefined();
  });

  it("cada linha tem 'Todos os envios' e o catálogo do Setor, com o que já recebe marcado", () => {
    const { result } = montar();

    const ana = result.current.linhas.envios(0);
    expect(ana?.opcoes.map((o) => o.rotulo)).toEqual(["Todos os envios", "DAS", "Avisos"]);
    expect(ana?.marcados).toEqual(["das"]);
  });

  it("Editar abre a linha; Cancelar desfaz o que se digitou e se marcou, sem chamar o servidor", async () => {
    const { result } = montar();

    act(() => result.current.linhas.onEditar(0));
    expect(result.current.linhas.editando(0)).toBe(true);
    act(() => {
      result.current.form.setValue("contatos.0.nome", "Ana Trocada");
      result.current.linhas.envios(0)!.onAlternar("avisos");
    });
    expect(result.current.linhas.envios(0)?.marcados).toEqual(["todos", "das", "avisos"]);
    act(() => result.current.linhas.onCancelar(0));

    expect(result.current.linhas.editando(0)).toBe(false);
    expect(result.current.form.getValues("contatos.0.nome")).toBe("Ana");
    expect(result.current.linhas.envios(0)?.marcados).toEqual(["das"]);
    expect(salvarContato).not.toHaveBeenCalled();
    expect(definirTipos).not.toHaveBeenCalled();
  });

  it("'Todos os envios' marca os outros; desmarcar um desmarca o 'Todos'", () => {
    const { result } = montar();

    act(() => result.current.linhas.onEditar(1));
    act(() => result.current.linhas.envios(1)!.onAlternar("todos"));
    expect(result.current.linhas.envios(1)?.marcados).toEqual(["todos", "das", "avisos"]);
    act(() => result.current.linhas.envios(1)!.onAlternar("das"));

    expect(result.current.linhas.envios(1)?.marcados).toEqual(["avisos"]);
  });

  it("Salvar grava o contato e os envios juntos, fecha a linha e anuncia", async () => {
    salvarContato.mockResolvedValue({ ok: true, data: { id: "c-1" } });
    definirTipos.mockResolvedValue({ ok: true, data: undefined });
    const { result } = montar();
    act(() => result.current.linhas.onEditar(0));
    act(() => {
      result.current.form.setValue("contatos.0.nome", "Ana Trocada");
      result.current.linhas.envios(0)!.onAlternar("avisos");
    });

    await act(() => result.current.linhas.onSalvar(0));

    expect(salvarContato).toHaveBeenCalledWith({
      clienteId: "cli-1",
      contato: {
        id: "c-1",
        nome: "Ana Trocada",
        telefone: "(11) 99999-0000",
        email: "ana@exemplo.com",
      },
    });
    expect(definirTipos).toHaveBeenCalledWith({
      clienteId: "cli-1",
      contatoId: "c-1",
      tipos: ["todos", "das", "avisos"],
      canal: "whatsapp",
    });
    expect(result.current.linhas.editando(0)).toBe(false);
    expect(result.current.linhas.aviso?.trim()).toBe("Contato 1 salvo.");
  });

  it("linha nova: Salvar cria o contato e grava os envios marcados com o id novo", async () => {
    salvarContato.mockResolvedValue({ ok: true, data: { id: "novo-id" } });
    definirTipos.mockResolvedValue({ ok: true, data: undefined });
    const { result } = montar();
    act(() => result.current.linhas.envios(2)!.onAlternar("todos"));

    await act(() => result.current.linhas.onSalvar(2));

    expect(salvarContato).toHaveBeenCalledWith({
      clienteId: "cli-1",
      contato: expect.objectContaining({ nome: "Nova" }),
    });
    expect(definirTipos).toHaveBeenCalledWith({
      clienteId: "cli-1",
      contatoId: "novo-id",
      tipos: ["todos", "das", "avisos"],
    });
    expect(result.current.form.getValues("contatos.2.id")).toBe("novo-id");
    expect(result.current.linhas.editando(2)).toBe(false);
  });

  it("contato de outro Setor: Salvar grava só os envios, nunca o contato", async () => {
    definirTipos.mockResolvedValue({ ok: true, data: undefined });
    const { result } = montar();
    act(() => result.current.linhas.onEditar(1));
    act(() => result.current.linhas.envios(1)!.onAlternar("avisos"));

    await act(() => result.current.linhas.onSalvar(1));

    expect(salvarContato).not.toHaveBeenCalled();
    expect(definirTipos).toHaveBeenCalledWith({
      clienteId: "cli-1",
      contatoId: "c-2",
      tipos: ["avisos"],
    });
    expect(result.current.linhas.editando(1)).toBe(false);
  });

  describe("canal do envio (contato com os dois canais)", () => {
    const SEM_CANAL = { ...ANA, canal: "" };

    it("o 'Enviar por' só aparece com os dois canais e ao menos um envio marcado", () => {
      const { result } = montar([ANA, BIA, NOVA]);

      expect(result.current.linhas.envios(0)?.canal?.valor).toBe("whatsapp");
      expect(result.current.linhas.envios(0)?.canal?.opcoes.map((o) => o.valor)).toEqual([
        "whatsapp",
        "email",
        "whatsapp_e_email",
      ]);
      // Um canal só (e-mail ou WhatsApp): sem escolha.
      expect(result.current.linhas.envios(1)?.canal).toBeUndefined();
      expect(result.current.linhas.envios(2)?.canal).toBeUndefined();
      // Sem envio marcado não há por onde enviar.
      const vazio = montar([{ ...ANA, tipos: [] }]);
      expect(vazio.result.current.linhas.envios(0)?.canal).toBeUndefined();
    });

    it("Salvar sem o canal escolhido não grava nada e o erro vai ao campo", async () => {
      const { result } = montar([SEM_CANAL]);
      act(() => result.current.linhas.onEditar(0));

      await act(() => result.current.linhas.onSalvar(0));

      expect(salvarContato).not.toHaveBeenCalled();
      expect(definirTipos).not.toHaveBeenCalled();
      expect(result.current.linhas.editando(0)).toBe(true);
      expect(result.current.linhas.envios(0)?.canal?.erro).toBe(
        "Escolha por onde enviar a este contato.",
      );
    });

    it("escolher o canal limpa o erro e Salvar grava os envios com o canal", async () => {
      definirTipos.mockResolvedValue({ ok: true, data: undefined });
      const { result } = montar([SEM_CANAL]);
      act(() => result.current.linhas.onEditar(0));
      await act(() => result.current.linhas.onSalvar(0));

      act(() => result.current.linhas.envios(0)!.canal!.onMudar("email"));
      expect(result.current.linhas.envios(0)?.canal?.erro).toBeUndefined();
      await act(() => result.current.linhas.onSalvar(0));

      expect(definirTipos).toHaveBeenCalledWith({
        clienteId: "cli-1",
        contatoId: "c-1",
        tipos: ["das"],
        canal: "email",
      });
      expect(result.current.linhas.editando(0)).toBe(false);
    });

    it("trocar só o canal grava de novo, sem regravar o contato", async () => {
      definirTipos.mockResolvedValue({ ok: true, data: undefined });
      const { result } = montar([ANA]);
      act(() => result.current.linhas.onEditar(0));
      act(() => result.current.linhas.envios(0)!.canal!.onMudar("whatsapp_e_email"));

      await act(() => result.current.linhas.onSalvar(0));

      expect(salvarContato).not.toHaveBeenCalled();
      expect(definirTipos).toHaveBeenCalledWith({
        clienteId: "cli-1",
        contatoId: "c-1",
        tipos: ["das"],
        canal: "whatsapp_e_email",
      });
    });

    it("Cancelar devolve o canal de antes da edição", () => {
      const { result } = montar([ANA]);
      act(() => result.current.linhas.onEditar(0));
      act(() => result.current.linhas.envios(0)!.canal!.onMudar("email"));

      act(() => result.current.linhas.onCancelar(0));

      expect(result.current.form.getValues("contatos.0.canal")).toBe("whatsapp");
    });

    it("contato com um canal só grava sem canal", async () => {
      definirTipos.mockResolvedValue({ ok: true, data: undefined });
      const { result } = montar([BIA]);
      act(() => result.current.linhas.onEditar(0));
      act(() => result.current.linhas.envios(0)!.onAlternar("avisos"));

      await act(() => result.current.linhas.onSalvar(0));

      expect(definirTipos).toHaveBeenCalledWith({
        clienteId: "cli-1",
        contatoId: "c-2",
        tipos: ["avisos"],
      });
    });
  });

  it("sem mudança nos envios nem nos campos, Salvar só fecha a linha", async () => {
    const { result } = montar();
    act(() => result.current.linhas.onEditar(0));

    await act(() => result.current.linhas.onSalvar(0));

    expect(salvarContato).not.toHaveBeenCalled();
    expect(definirTipos).not.toHaveBeenCalled();
    expect(result.current.linhas.editando(0)).toBe(false);
  });

  it("o Admin salva o contato e não chama os envios", async () => {
    salvarContato.mockResolvedValue({ ok: true, data: { id: "novo-id" } });
    const { result } = montar([NOVA], true);

    await act(() => result.current.linhas.onSalvar(0));

    expect(salvarContato).toHaveBeenCalled();
    expect(definirTipos).not.toHaveBeenCalled();
    expect(result.current.form.getValues("contatos.0.donoSetor")).toBeNull();
  });

  it("contato inválido marca o campo e não chama nenhuma action", async () => {
    const { result } = montar([{ nome: "", telefone: "", email: "", tipos: [] }]);

    await act(() => result.current.linhas.onSalvar(0));

    expect(salvarContato).not.toHaveBeenCalled();
    expect(definirTipos).not.toHaveBeenCalled();
    expect(result.current.erros.contatos?.[0]?.nome?.message).toBe("obrigatório");
  });

  it("falha ao salvar o contato aparece só na linha e ela segue em edição", async () => {
    salvarContato.mockResolvedValue({ ok: false, error: { code: "X", message: "Já existe." } });
    const { result } = montar();

    await act(() => result.current.linhas.onSalvar(2));

    expect(result.current.linhas.erroDaLinha(2)).toBe("Já existe.");
    expect(result.current.linhas.erroDaLinha(0)).toBeUndefined();
    expect(result.current.linhas.editando(2)).toBe(true);
    expect(definirTipos).not.toHaveBeenCalled();
  });

  it("contato salvo mas envios recusados: diz isso na linha, mantém em edição e não regrava o contato", async () => {
    salvarContato.mockResolvedValue({ ok: true, data: { id: "novo-id" } });
    definirTipos
      .mockResolvedValueOnce({ ok: false, error: { code: "X", message: "Sem permissão." } })
      .mockResolvedValueOnce({ ok: true, data: undefined });
    const { result } = montar();
    act(() => result.current.linhas.envios(2)!.onAlternar("das"));

    await act(() => result.current.linhas.onSalvar(2));
    expect(result.current.linhas.erroDaLinha(2)).toBe(
      "Contato salvo, mas os envios não: Sem permissão.",
    );
    expect(result.current.linhas.editando(2)).toBe(true);

    await act(() => result.current.linhas.onSalvar(2));
    expect(salvarContato).toHaveBeenCalledTimes(1);
    expect(definirTipos).toHaveBeenCalledTimes(2);
    expect(result.current.linhas.editando(2)).toBe(false);
  });

  it("Cancelar na linha nova descarta a linha; sendo a única, só esvazia", () => {
    const { result } = montar();

    act(() => result.current.linhas.onCancelar(2));
    expect(result.current.fields).toHaveLength(2);

    const unica = montar([NOVA]);
    act(() => unica.result.current.linhas.onCancelar(0));
    expect(unica.result.current.fields).toHaveLength(1);
    expect(unica.result.current.form.getValues("contatos.0.nome")).toBe("");
  });

  it("linha em edição com conteúdo segura o Salvar do cadastro; a nova em branco não", () => {
    const { result } = montar([ANA, { nome: "", telefone: "", email: "", tipos: [] }]);
    expect(result.current.linhas.motivoDoBloqueio).toBeUndefined();

    act(() => result.current.linhas.onEditar(0));

    expect(result.current.linhas.motivoDoBloqueio).toBe(
      "Salve ou cancele a edição do contato 1 para salvar o cadastro.",
    );
    act(() => result.current.linhas.onCancelar(0));
    expect(result.current.linhas.motivoDoBloqueio).toBeUndefined();
  });

  it("avisa, na linha, quando o contato apagou o canal que o envio usa", () => {
    const { result } = montar([{ ...ANA, telefone: "" }, BIA], false, [
      { contatoId: "c-1", tipo: "das", canal: "whatsapp" },
    ]);

    expect(result.current.linhas.envios(0)?.aviso).toContain("deixou de ter o WhatsApp");
    expect(result.current.linhas.envios(1)?.aviso).toBeUndefined();
  });

  describe("número que já é de um contato do Cliente", () => {
    const BIA_COM_NUMERO = { ...BIA, telefone: "(11) 97777-0000" };
    const digitar = (result: ReturnType<typeof montar>["result"], telefone: string) => {
      act(() => result.current.form.setValue("contatos.2.telefone", telefone));
      act(() => result.current.linhas.onSairDoTelefone(2));
    };

    it("só avisa depois de sair do campo, e o aviso some quando o número muda ou fica vazio", () => {
      const { result } = montar([ANA, BIA_COM_NUMERO, { ...NOVA, telefone: "" }]);

      act(() => result.current.form.setValue("contatos.2.telefone", "(11) 99999-0000"));
      expect(result.current.linhas.numeroRepetido(2)).toBeUndefined();

      act(() => result.current.linhas.onSairDoTelefone(2));
      expect(result.current.linhas.numeroRepetido(2)?.texto).toBe(
        "Este número já é do contato Ana, que já está na lista deste Setor.",
      );

      act(() => result.current.form.setValue("contatos.2.telefone", "(11) 99999-000"));
      expect(result.current.linhas.numeroRepetido(2)).toBeUndefined();
      digitar(result, "");
      expect(result.current.linhas.numeroRepetido(2)).toBeUndefined();
    });

    it("contato da lista do Setor: só informa, sem 'Usar este contato'", () => {
      const { result } = montar([ANA, BIA_COM_NUMERO, { ...NOVA, telefone: "" }]);

      digitar(result, "11999990000");

      expect(result.current.linhas.numeroRepetido(2)?.onUsar).toBeUndefined();
    });

    it("contato de outro Setor fora da lista: oferece usá-lo e a linha vira o contato escolhido", () => {
      const { result } = montar([ANA, BIA_COM_NUMERO, { ...NOVA, telefone: "" }]);

      digitar(result, "(11) 97777-0000");
      const repetido = result.current.linhas.numeroRepetido(2);
      expect(repetido?.texto).toBe("Este número já é do contato Bia.");

      act(() => repetido?.onUsar?.());

      expect(result.current.linhas.visivel(1)).toBe(true);
      expect(result.current.linhas.editando(1)).toBe(true);
      expect(result.current.fields).toHaveLength(2);
    });

    it("linha já salva não é conferida", () => {
      const { result } = montar([ANA, BIA_COM_NUMERO, { ...NOVA, telefone: "" }]);

      act(() => result.current.form.setValue("contatos.0.telefone", "(11) 97777-0000"));
      act(() => result.current.linhas.onSairDoTelefone(0));

      expect(result.current.linhas.numeroRepetido(0)).toBeUndefined();
    });
  });
});
