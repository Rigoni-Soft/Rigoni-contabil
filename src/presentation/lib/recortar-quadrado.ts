// Recorta o quadrado central de uma imagem e a reduz a `lado`×`lado` em WebP, no navegador (sem
// dependência). O canvas regrava a imagem, então o EXIF (local, data, aparelho) não sai com ela;
// `from-image` aplica a orientação do EXIF antes de recortar, para a foto de celular não sair deitada.
// Lança se o navegador não decodifica a imagem ou não grava WebP: quem chama avisa o usuário.
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
