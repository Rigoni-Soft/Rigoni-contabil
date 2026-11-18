import { LADO_DO_AVATAR } from "./avatar.presenter";

// Recorta o quadrado central e reduz para WebP 256×256 no navegador (sem dependência): o canvas regrava
// a imagem, então o EXIF (local, data, aparelho) não vai para o servidor. `from-image` aplica a
// orientação do EXIF antes de recortar, para a foto de celular não sair deitada.
export async function recortarParaAvatar(arquivo: File): Promise<Blob> {
  const imagem = await createImageBitmap(arquivo, { imageOrientation: "from-image" });
  try {
    const lado = Math.min(imagem.width, imagem.height);
    const canvas = document.createElement("canvas");
    canvas.width = LADO_DO_AVATAR;
    canvas.height = LADO_DO_AVATAR;
    const contexto = canvas.getContext("2d");
    if (!contexto) throw new Error("canvas indisponível");
    contexto.drawImage(
      imagem,
      (imagem.width - lado) / 2,
      (imagem.height - lado) / 2,
      lado,
      lado,
      0,
      0,
      LADO_DO_AVATAR,
      LADO_DO_AVATAR,
    );
    return await new Promise<Blob>((resolver, rejeitar) =>
      canvas.toBlob(
        (blob) => (blob ? resolver(blob) : rejeitar(new Error("WebP indisponível"))),
        "image/webp",
        0.85,
      ),
    );
  } finally {
    imagem.close();
  }
}
