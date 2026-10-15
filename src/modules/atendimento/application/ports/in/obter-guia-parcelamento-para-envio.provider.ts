import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// Guia do parcelamento pronta para a comunicação: a parcela já formatada para o cliente e o PDF
// publicado em endereço que o provedor de envio busca.
export type GuiaParcelamentoParaEnvio = {
  parcela: string; // MM/AAAA
  guia: { url: string; nomeArquivo: string };
};

export interface ObterGuiaParcelamentoParaEnvioPort {
  execute(clienteId: string): Promise<Result<GuiaParcelamentoParaEnvio, AppError>>;
}
