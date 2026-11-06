import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// Guia do DAS pronta para a comunicação: competência e vencimento já formatados para o cliente,
// e o PDF publicado em endereço que o provedor de envio busca.
export type GuiaDasParaEnvio = {
  competencia: string; // MM/AAAA
  vencimento: string; // DD/MM/AAAA
  guia: { url: string; nomeArquivo: string };
  // Objeto publicado: quem registra o envio aceito o guarda para o reenvio.
  caminho: string;
};

export interface ObterGuiaDasParaEnvioPort {
  // `mes` (AAAA-MM) é o mês do envio: a guia fica guardada nele para o reenvio.
  execute(clienteId: string, mes: string): Promise<Result<GuiaDasParaEnvio, AppError>>;
}
