export async function recortarQuadrado(arquivo: File, lado: number): Promise<Blob> {
  const imagem = await createImageBitmap(arquivo, { imageOrientation: "from-image" });
  try {
    const corte = Math.min(imagem.width, imagem.height);
    const tela = document.createElement("canvas");
    tela.width = lado;
    tela.height = lado;
    const contexto = tela.getContext("2d");
    if (!contexto) throw new Error("canvas indisponível");
    contexto.drawImage(
      imagem,
      (imagem.width - corte) / 2,
      (imagem.height - corte) / 2,
      corte,
      corte,
      0,
      0,
      lado,
      lado,
    );
    return await new Promise<Blob>((resolver, rejeitar) =>
      tela.toBlob(
        (blob) => (blob ? resolver(blob) : rejeitar(new Error("WebP indisponível"))),
        "image/webp",
        0.85,
      ),
    );
  } finally {
    imagem.close();
  }
}
