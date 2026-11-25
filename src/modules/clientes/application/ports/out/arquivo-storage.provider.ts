import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export interface ArquivoStoragePort {
  enviar(caminho: string, arquivo: File): Promise<Result<{ caminho: string }, AppError>>;
  remover(caminhos: string[]): Promise<Result<void, AppError>>;
}

export interface ArquivoInspecionavelPort extends ArquivoStoragePort {
  inspecionar(
    caminho: string,
  ): Promise<Result<{ tipoMime: string; tamanho: number } | null, AppError>>;
}

export interface ArquivoComLinkPort {
  linkTemporario(caminho: string, validadeSegundos: number): Promise<Result<string, AppError>>;
}
