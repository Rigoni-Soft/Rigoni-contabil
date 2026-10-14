import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// Guia do DAS pronta para a comunicação: competência e vencimento já formatados para o cliente,
// e o PDF publicado em endereço que o provedor de envio busca.
export type GuiaDasParaEnvio = {
  competencia: string; // MM/AAAA
  vencimento: string; // DD/MM/AAAA
  guia: { url: string; nomeArquivo: string };
};

export interface ObterGuiaDasParaEnvioPort {
  execute(clienteId: string): Promise<Result<GuiaDasParaEnvio, AppError>>;
}
