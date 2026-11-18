// Limites do que o Funcionário escolhe (o navegador reduz para WebP 256×256 antes de enviar; ADR 0012).
export const TIPOS_DA_FOTO = ["image/jpeg", "image/png", "image/webp"] as const;
export const LIMITE_DA_FOTO_BYTES = 5 * 1024 * 1024;
export const LADO_DO_AVATAR = 256;
export const ACEITAR_FOTO = TIPOS_DA_FOTO.join(",");

// Aviso para o arquivo escolhido que o sistema não aceita; `undefined` = pode seguir.
export function avisoDaFoto(arquivo: { type: string; size: number }): string | undefined {
  if (!(TIPOS_DA_FOTO as readonly string[]).includes(arquivo.type)) {
    return "Formato não aceito. Escolha uma foto JPEG, PNG ou WebP.";
  }
  if (arquivo.size > LIMITE_DA_FOTO_BYTES) {
    return "A foto passa de 5 MB. Escolha uma menor.";
  }
  return undefined;
}

// O que a tela do avatar está fazendo (o rótulo do botão correspondente mostra o progresso): o tipo
// mora na View e o presenter o reexporta, para o hook ter uma fonte só.
export type { AcaoDoAvatar } from "@/presentation/components/organisms/avatar-da-conta.component";
