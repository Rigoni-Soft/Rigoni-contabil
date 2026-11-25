import type { ChaveGuia } from "@/modules/atendimento/domain/services/guia-guardada.service";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type GuiaPublicada = { url: string; caminho: string };

export interface GuiaPublicadaPort {
  publicar(
    clienteId: string,
    guia: { nomeArquivo: string; pdfBase64: string },
    chave: ChaveGuia,
  ): Promise<Result<GuiaPublicada, AppError>>;
  reencontrar(clienteId: string, caminho: string): Promise<Result<string, AppError>>;
}
