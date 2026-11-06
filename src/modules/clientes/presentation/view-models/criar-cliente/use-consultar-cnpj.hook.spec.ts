import { act, renderHook } from "@testing-library/react";

import { useConsultarCnpj, type DadosCnpjPublico } from "./use-consultar-cnpj.hook";

describe("useConsultarCnpj", () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
  });

  it("devolve empresa e regime 'simples_nacional' quando a API confirma opção pelo Simples", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ razao_social: "Padaria Pão Quente Ltda", opcao_pelo_simples: true }),
    });
    const { result } = renderHook(() => useConsultarCnpj());

    let dados: DadosCnpjPublico | null = null;
    await act(async () => {
      dados = await result.current.consultar("11444777000161");
    });

    expect(dados).toEqual({ empresa: "Padaria Pão Quente Ltda", regime: "simples_nacional" });
  });

  it("devolve regime 'mei' quando a API confirma opção pelo MEI (tem prioridade sobre Simples)", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        razao_social: "Padaria Pão Quente Ltda",
        opcao_pelo_simples: true,
        opcao_pelo_mei: true,
      }),
    });
    const { result } = renderHook(() => useConsultarCnpj());

    let dados: DadosCnpjPublico | null = null;
    await act(async () => {
      dados = await result.current.consultar("11444777000161");
    });

    expect(dados).toEqual(expect.objectContaining({ regime: "mei" }));
  });

  it("devolve regime undefined quando a API não confirma Simples nem MEI (Presumido/Real não são dado público confiável)", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ razao_social: "Padaria Pão Quente Ltda", opcao_pelo_simples: false }),
    });
    const { result } = renderHook(() => useConsultarCnpj());

    let dados: DadosCnpjPublico | null = null;
    await act(async () => {
      dados = await result.current.consultar("11444777000161");
    });

    expect(dados).toEqual({ empresa: "Padaria Pão Quente Ltda", regime: undefined });
  });

  it("devolve null sem lançar quando a API responde erro", async () => {
    fetchMock.mockResolvedValue({ ok: false });
    const { result } = renderHook(() => useConsultarCnpj());

    let dados: DadosCnpjPublico | null = null;
    await act(async () => {
      dados = await result.current.consultar("11444777000161");
    });

    expect(dados).toBeNull();
  });

  it("devolve null sem lançar quando a requisição falha (rede indisponível)", async () => {
    fetchMock.mockRejectedValue(new Error("falha de rede"));
    const { result } = renderHook(() => useConsultarCnpj());

    let dados: DadosCnpjPublico | null = null;
    await act(async () => {
      dados = await result.current.consultar("11444777000161");
    });

    expect(dados).toBeNull();
  });

  it("não consulta com CNPJ incompleto", async () => {
    const { result } = renderHook(() => useConsultarCnpj());

    let dados: DadosCnpjPublico | null = null;
    await act(async () => {
      dados = await result.current.consultar("114447770001");
    });

    expect(dados).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
