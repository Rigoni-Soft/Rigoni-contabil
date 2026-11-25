import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type ArquivoAnexo = { nome: string; tipoMime: string; conteudo: Uint8Array };

export type LinkTemporario = { url: string; urlVisualizacao: string; expiraEm: string };

export interface AnexosAtendimentoPort {
  guardar(input: {
    atendimentoId: string;
    arquivo: ArquivoAnexo;
  }): Promise<Result<string, AppError>>;
  linksTemporarios(caminhos: string[]): Promise<Result<Record<string, LinkTemporario>, AppError>>;
  remover(caminho: string): Promise<Result<void, AppError>>;
  reservar(caminho: string, atendimentoId: string): Promise<Result<boolean, AppError>>;
  liberarReserva(caminho: string): Promise<Result<void, AppError>>;
  inspecionar(
    caminho: string,
  ): Promise<Result<{ tipoMime: string; tamanho: number } | null, AppError>>;
  baixar(caminho: string): Promise<Result<Uint8Array, AppError>>;
  cabecalho(caminho: string, bytes: number): Promise<Result<Uint8Array, AppError>>;
}
