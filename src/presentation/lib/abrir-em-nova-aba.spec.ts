import { abrirEmNovaAba } from "./abrir-em-nova-aba";

const aba = () => ({ location: { href: "" }, close: jest.fn(), opener: {} });
const abrirJanela = (valor: ReturnType<typeof aba> | null) =>
  jest.spyOn(window, "open").mockReturnValue(valor as unknown as Window);
const ok = (url: string) => async () => ({ ok: true as const, data: { url } });

afterEach(() => jest.restoreAllMocks());

describe("abrirEmNovaAba", () => {
  it("abre a aba no clique e a leva ao link quando ele chega", async () => {
    const nova = aba();
    const janela = abrirJanela(nova);

    const resultado = await abrirEmNovaAba(ok("https://storage.exemplo/doc"));

    expect(janela).toHaveBeenCalledWith("about:blank", "_blank");
    expect(nova.location.href).toBe("https://storage.exemplo/doc");
    expect(nova.opener).toBeNull();
    expect(resultado).toEqual({ tipo: "aberta" });
  });

  it("aba barrada devolve o link para a tela oferecer", async () => {
    abrirJanela(null);

    expect(await abrirEmNovaAba(ok("https://storage.exemplo/doc"))).toEqual({
      tipo: "bloqueada",
      url: "https://storage.exemplo/doc",
    });
  });

  it("recusa do servidor fecha a aba e devolve a mensagem", async () => {
    const nova = aba();
    abrirJanela(nova);

    const resultado = await abrirEmNovaAba(async () => ({
      ok: false as const,
      error: { code: "NOT_FOUND", message: "Guia não encontrada." },
    }));

    expect(resultado).toEqual({ tipo: "erro", mensagem: "Guia não encontrada." });
    expect(nova.close).toHaveBeenCalled();
  });

  it("action que rejeita fecha a aba e repassa o erro", async () => {
    const nova = aba();
    abrirJanela(nova);

    await expect(
      abrirEmNovaAba(async () => {
        throw new Error("rede");
      }),
    ).rejects.toThrow("rede");
    expect(nova.close).toHaveBeenCalled();
  });
});
