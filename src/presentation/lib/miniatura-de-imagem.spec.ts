import { gerarMiniatura } from "./miniatura-de-imagem";

describe("gerarMiniatura", () => {
  const FOTO = new File(["x"], "foto.png", { type: "image/png" });

  afterEach(() => {
    delete (globalThis as { createImageBitmap?: unknown }).createImageBitmap;
  });

  it("sem suporte do navegador, segue sem miniatura", async () => {
    expect(await gerarMiniatura(FOTO, 320)).toBeNull();
  });

  it("imagem que o navegador não decodifica não derruba o envio", async () => {
    globalThis.createImageBitmap = jest.fn().mockRejectedValue(new Error("corrompida"));
    expect(await gerarMiniatura(FOTO, 320)).toBeNull();
  });

  it("reduz mantendo a proporção, sem ampliar imagem pequena", async () => {
    const desenhar = jest.fn();
    const tela = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage: desenhar }),
      toBlob: (cb: (b: Blob | null) => void) => cb(new Blob(["w"], { type: "image/webp" })),
    };
    jest.spyOn(document, "createElement").mockReturnValue(tela as unknown as HTMLElement);
    globalThis.createImageBitmap = jest
      .fn()
      .mockResolvedValueOnce({ width: 4000, height: 3000, close: jest.fn() })
      .mockResolvedValueOnce({ width: 100, height: 50, close: jest.fn() });

    const grande = await gerarMiniatura(FOTO, 320);
    expect([tela.width, tela.height]).toEqual([320, 240]);
    expect(grande?.type).toBe("image/webp");

    await gerarMiniatura(FOTO, 320);
    expect([tela.width, tela.height]).toEqual([100, 50]);
    jest.restoreAllMocks();
  });
});
