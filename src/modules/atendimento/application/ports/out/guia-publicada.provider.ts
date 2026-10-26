import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// Onde a guia fica guardada: cliente/id/AAAAMM, o mesmo caminho a cada tentativa e a cada reenvio.
export type ChaveGuia = { id: string; parcela: string };

// Guarda o PDF da guia e devolve o endereço temporário que o provedor de mensagem/e-mail busca.
export interface GuiaPublicadaPort {
  publicar(
    clienteId: string,
    guia: { nomeArquivo: string; pdfBase64: string },
    chave: ChaveGuia,
  ): Promise<Result<string, AppError>>;
  // Novo endereço da guia já publicada com essa chave, ou null se não existe: reenvio sem chamar o
  // provedor fiscal.
  reencontrar(clienteId: string, chave: ChaveGuia): Promise<Result<string | null, AppError>>;
}
