import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// Guarda o PDF da guia e devolve o endereço temporário que o provedor de mensagem/e-mail busca.
// Com `parcelamento` (id e AAAAMM) a guia fica em cliente/parcelamento/AAAAMM, o mesmo caminho a
// cada tentativa; sem ele, num objeto novo por envio.
export interface GuiaPublicadaPort {
  publicar(
    clienteId: string,
    guia: { nomeArquivo: string; pdfBase64: string },
    parcelamento?: { id: string; parcela: string },
  ): Promise<Result<string, AppError>>;
}

export interface GuiaGuardadaPort {
  // Novo endereço da guia já publicada com essa chave (cliente/id/parcela), ou null se não existe:
  // reenvio sem chamar o provedor fiscal.
  reencontrar(
    clienteId: string,
    chave: { id: string; parcela: string },
  ): Promise<Result<string | null, AppError>>;
}
