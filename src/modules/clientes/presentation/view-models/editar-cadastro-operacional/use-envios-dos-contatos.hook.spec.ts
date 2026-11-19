import { act, renderHook } from "@testing-library/react";
import { useForm } from "react-hook-form";

import type { EditarCadastroOperacionalFormValues } from "./editar-cadastro-operacional.schema";
import { useEnviosDosContatos } from "./use-envios-dos-contatos.hook";

const definir = jest.fn();

jest.mock("./tipos-de-envio.actions", () => ({
  definirTiposDoContatoAction: (...a: unknown[]) => definir(...a),
}));

const ANA = {
  id: "c-1",
  nome: "Ana",
  telefone: "11999990000",
  email: "ana@exemplo.com",
  donoSetor: "simples_nacional",
  tipos: ["das"],
};
const BIA = {
  id: "c-2",
  nome: "Bia",
  telefone: "",
  email: "bia@exemplo.com",
  donoSetor: "rh",
  tipos: [],
};
const NOVA = { nome: "Nova", telefone: "11988880000", email: "", tipos: [] as string[] };
const TIPOS = [
  { slug: "das", rotulo: "DAS" },
  { slug: "avisos", rotulo: "Avisos" },
];

function montar(admin = false, destinos = [{ contatoId: "c-1", tipo: "das", canal: "whatsapp" }]) {
  return renderHook(() => {
    const form = useForm<EditarCadastroOperacionalFormValues>({
      defaultValues: { contatos: [ANA, BIA, NOVA] } as Partial<EditarCadastroOperacionalFormValues>,
    });
    const envios = useEnviosDosContatos({
      clienteId: "cli-1",
      form,
      destinos,
      tiposDeEnvio: TIPOS,
      setorDoCadastro: "simples_nacional",
      admin,
    });
    return { form, envios };
  });
}

describe("useEnviosDosContatos", () => {
  beforeEach(() => definir.mockReset());

  it("cada linha tem 'Todos os envios' e o catálogo, com o que o contato já recebe marcado", () => {
    const { result } = montar();

    const ana = result.current.envios.enviosDoContato(0);
    expect(ana?.opcoes.map((o) => o.rotulo)).toEqual(["Todos os envios", "DAS", "Avisos"]);
    expect(ana?.marcados).toEqual(["das"]);
    expect(result.current.envios.enviosDoContato(1)?.marcados).toEqual([]);
  });

  it("o Admin não define o que cada Setor envia: sem checkboxes", () => {
    const { result } = montar(true);

    expect(result.current.envios.enviosDoContato(0)).toBeUndefined();
  });

  it("marcar num contato salvo grava na hora, com a lista nova, e anuncia", async () => {
    definir.mockResolvedValue({ ok: true, data: undefined });
    const { result } = montar();

    await act(() => result.current.envios.enviosDoContato(1)!.onAlternar("avisos"));

    expect(definir).toHaveBeenCalledWith({
      clienteId: "cli-1",
      contatoId: "c-2",
      tipos: ["avisos"],
    });
    expect(result.current.envios.enviosDoContato(1)?.marcados).toEqual(["avisos"]);
    expect(result.current.envios.aviso?.trim()).toBe("Avisos marcado no contato 2.");
  });

  it("desmarcar tira o tipo da lista", async () => {
    definir.mockResolvedValue({ ok: true, data: undefined });
    const { result } = montar();

    await act(() => result.current.envios.enviosDoContato(0)!.onAlternar("das"));

    expect(definir).toHaveBeenCalledWith(expect.objectContaining({ contatoId: "c-1", tipos: [] }));
    expect(result.current.envios.aviso?.trim()).toBe("DAS desmarcado no contato 1.");
  });

  it("contato ainda não salvo espera o Salvar da linha: nada é marcado nem gravado", async () => {
    const { result } = montar();

    expect(result.current.envios.enviosDoContato(2)?.semContatoSalvo).toBe(true);
    expect(result.current.envios.enviosDoContato(0)?.semContatoSalvo).toBe(false);
    await act(() => result.current.envios.enviosDoContato(2)!.onAlternar("todos"));

    expect(definir).not.toHaveBeenCalled();
    expect(result.current.envios.enviosDoContato(2)?.marcados).toEqual([]);
  });

  it("falha do servidor desfaz a marca e mostra o motivo na linha", async () => {
    definir.mockResolvedValue({ ok: false, error: { code: "X", message: "Sem permissão." } });
    const { result } = montar();

    await act(() => result.current.envios.enviosDoContato(1)!.onAlternar("avisos"));

    expect(result.current.envios.enviosDoContato(1)?.marcados).toEqual([]);
    expect(result.current.envios.enviosDoContato(1)?.aviso).toBe("Sem permissão.");
    expect(result.current.envios.enviosDoContato(0)?.aviso).toBeUndefined();
  });

  it("avisa, na linha, quando o contato apagou o canal que o envio usa", () => {
    const { result } = montar(false, [{ contatoId: "c-2", tipo: "das", canal: "whatsapp" }]);

    expect(result.current.envios.enviosDoContato(1)?.aviso).toContain("deixou de ter o WhatsApp");
  });

  it("contato de outro Setor tem o texto de leitura; o do próprio Setor, não", () => {
    const { result } = montar();

    expect(result.current.envios.contatoDoutroSetor(0)).toBeUndefined();
    expect(result.current.envios.contatoDoutroSetor(1)).toContain("Contato do RH");
  });
});
