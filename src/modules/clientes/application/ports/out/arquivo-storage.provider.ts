import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export interface ArquivoStoragePort {
  enviar(caminho: string, arquivo: File): Promise<Result<{ caminho: string }, AppError>>;
  // Compensação: remove os objetos já enviados quando o cadastro falha depois do upload.
  // Só é ok se TODOS foram removidos.
  remover(caminhos: string[]): Promise<Result<void, AppError>>;
}

// Para quem revalida o que o Storage guardou (tipo e tamanho), em vez de confiar só na tela.
export interface ArquivoInspecionavelPort extends ArquivoStoragePort {
  // null = o objeto não está lá (ou o Storage não o devolveu).
  inspecionar(
    caminho: string,
  ): Promise<Result<{ tipoMime: string; tamanho: number } | null, AppError>>;
}

// Para quem deixa o usuário abrir um arquivo do bucket privado: o servidor checa a permissão antes.
export interface ArquivoComLinkPort {
  linkTemporario(caminho: string, validadeSegundos: number): Promise<Result<string, AppError>>;
}
