import { recortarQuadrado } from "./recortar-quadrado";

describe("recortarQuadrado", () => {
  const FOTO = new File(["x"], "foto.png", { type: "image/png" });

  afterEach(() => {
    delete (globalThis as { createImageBitmap?: unknown }).createImageBitmap;
    jest.restoreAllMocks();
  });

  function tela(blob: Blob | null) {
    const desenhar = jest.fn();
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage: desenhar }),
      toBlob: (cb: (b: Blob | null) => void) => cb(blob),
    };
    jest.spyOn(document, "createElement").mockReturnValue(canvas as unknown as HTMLElement);
    return { canvas, desenhar };
  }

  it("recorta o quadrado central da imagem larga e reduz ao lado pedido", async () => {
    const { canvas, desenhar } = tela(new Blob(["w"], { type: "image/webp" }));
    const fechar = jest.fn();
    globalThis.createImageBitmap = jest
      .fn()
      .mockResolvedValue({ width: 400, height: 200, close: fechar });

    const blob = await recortarQuadrado(FOTO, 256);

    expect([canvas.width, canvas.height]).toEqual([256, 256]);
    expect(desenhar).toHaveBeenCalledWith(expect.anything(), 100, 0, 200, 200, 0, 0, 256, 256);
    expect(blob.type).toBe("image/webp");
    expect(fechar).toHaveBeenCalled();
  });

  it("aplica a orientação do EXIF ao decodificar", async () => {
    tela(new Blob(["w"], { type: "image/webp" }));
    const decodificar = jest.fn().mockResolvedValue({ width: 10, height: 10, close: jest.fn() });
    globalThis.createImageBitmap = decodificar;

    await recortarQuadrado(FOTO, 256);

    expect(decodificar).toHaveBeenCalledWith(FOTO, { imageOrientation: "from-image" });
  });

  it("imagem que o navegador não decodifica lança", async () => {
    globalThis.createImageBitmap = jest.fn().mockRejectedValue(new Error("corrompida"));

    await expect(recortarQuadrado(FOTO, 256)).rejects.toThrow("corrompida");
  });

  it("navegador sem WebP lança e ainda libera a imagem", async () => {
    tela(null);
    const fechar = jest.fn();
    globalThis.createImageBitmap = jest
      .fn()
      .mockResolvedValue({ width: 10, height: 10, close: fechar });

    await expect(recortarQuadrado(FOTO, 256)).rejects.toThrow("WebP indisponível");
    expect(fechar).toHaveBeenCalled();
  });
});
