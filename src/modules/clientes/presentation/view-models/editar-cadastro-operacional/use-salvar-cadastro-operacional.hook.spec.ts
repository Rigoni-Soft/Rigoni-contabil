import { act, renderHook } from "@testing-library/react";

import { semChaves, useSalvarCadastroOperacional } from "./use-salvar-cadastro-operacional.hook";

const push = jest.fn();
const editar = jest.fn();
const atribuir = jest.fn();
const salvarParcelamentos = jest.fn();
const anexarGuia = jest.fn();

jest.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
jest.mock("./editar-cadastro-operacional.actions", () => ({
  editarCadastroOperacionalAction: (...a: unknown[]) => editar(...a),
}));
jest.mock("./atribuir-responsavel.actions", () => ({
  atribuirResponsavelAction: (...a: unknown[]) => atribuir(...a),
}));
jest.mock("./salvar-parcelamentos.actions", () => ({
  salvarParcelamentosAction: (...a: unknown[]) => salvarParcelamentos(...a),
}));
jest.mock("../anexar-guia-parcela-pgfn/anexar-guia-parcela-pgfn.actions", () => ({
  anexarGuiaParcelaPgfnAction: (...a: unknown[]) => anexarGuia(...a),
}));

const dados = { id: "c1", responsavelId: null, parcelamentos: [] } as never;
const valores = {
  formaEnvio: "whatsapp",
  contatos: [],
  parcelamentos: [],
  responsavelId: "u1",
} as never;

function montar(aoSalvar?: Parameters<typeof useSalvarCadastroOperacional>[0]["aoSalvar"]) {
  const setError = jest.fn();
  const hook = renderHook(() =>
    useSalvarCadastroOperacional({
      dados,
      podeAtribuirResponsavel: true,
      aoSalvar,
      getValues: jest.fn(() => ({ parcelamentos: [] })) as never,
      setValue: jest.fn(),
      setError,
    }),
  );
  return { ...hook, setError };
}

describe("semChaves", () => {
  it("remove só as chaves dadas", () => {
    expect(semChaves({ a: 1, b: 2, c: 3 }, "a", "c")).toEqual({ b: 2 });
  });
});

describe("useSalvarCadastroOperacional", () => {
  beforeEach(() => jest.resetAllMocks());

  it("salva, atribui o Responsável e navega", async () => {
    editar.mockResolvedValue({ ok: true });
    atribuir.mockResolvedValue({ ok: true });
    const { result } = montar({ tipo: "voltar", href: "/x" });
    await act(() => result.current.salvar(valores));
    expect(editar).toHaveBeenCalledWith(expect.not.objectContaining({ responsavelId: "u1" }));
    expect(atribuir).toHaveBeenCalledWith({ clienteId: "c1", responsavelId: "u1" });
    expect(result.current.sucesso).toBe(true);
    expect(result.current.pendente).toBe(false);
    expect(push).toHaveBeenCalledWith("/x");
  });

  it("erro de validação do servidor interrompe e marca o campo", async () => {
    editar.mockResolvedValue({
      ok: false,
      error: { message: "Inválido", fields: { formaEnvio: ["ruim"], clienteId: ["x"] } },
    });
    const { result, setError } = montar();
    await act(() => result.current.salvar(valores));
    expect(result.current.erroServidor).toBe("Inválido");
    expect(setError).toHaveBeenCalledTimes(1);
    expect(atribuir).not.toHaveBeenCalled();
  });

  it("rejeição antes de persistir diz que nada foi salvo", async () => {
    editar.mockRejectedValue(new Error("rede"));
    const { result } = montar();
    await act(() => result.current.salvar(valores));
    expect(result.current.erroServidor).toMatch(/^Não foi possível salvar agora/);
    expect(result.current.pendente).toBe(false);
  });

  it("rejeição na atribuição nomeia a etapa e a retentativa repete só a atribuição", async () => {
    editar.mockResolvedValue({ ok: true });
    atribuir.mockRejectedValueOnce(new Error("rede")).mockResolvedValue({ ok: true });
    const { result } = montar();
    await act(() => result.current.salvar(valores));
    expect(result.current.erroServidor).toMatch(
      /salvos, mas não foi possível atribuir o Responsável/,
    );
    await act(() => result.current.salvar(valores));
    expect(editar).toHaveBeenCalledTimes(1);
    expect(atribuir).toHaveBeenCalledTimes(2);
    expect(result.current.sucesso).toBe(true);
  });
});
