// Reduz uma imagem a uma miniatura WebP (lado maior = `lado`, sem ampliar). A conversa mostra esta
// e só baixa o original, de até 10 MB, quando o Funcionário o amplia. Devolve null se o navegador
// não decodifica a imagem: quem chama segue sem miniatura.
export async function gerarMiniatura(arquivo: File, lado: number): Promise<File | null> {
  if (typeof createImageBitmap !== "function") return null;
  try {
    const imagem = await createImageBitmap(arquivo);
    const escala = Math.min(1, lado / Math.max(imagem.width, imagem.height));
    const tela = document.createElement("canvas");
    tela.width = Math.max(1, Math.round(imagem.width * escala));
    tela.height = Math.max(1, Math.round(imagem.height * escala));
    tela.getContext("2d")?.drawImage(imagem, 0, 0, tela.width, tela.height);
    imagem.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      tela.toBlob(resolve, "image/webp", 0.8),
    );
    if (!blob || blob.type !== "image/webp") return null;
    return new File([blob], "miniatura.webp", { type: "image/webp" });
  } catch {
    return null;
  }
}
