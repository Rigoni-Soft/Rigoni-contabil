import type { TipoDocumentoContratual } from "@/modules/clientes/application/dtos/tipo-documento-contratual.dto";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// O que a tela recebe: nunca o caminho do arquivo.
export type DocumentoContratualVisivelDto = {
  tipo: TipoDocumentoContratual;
  numero: number | null;
  data: string | null;
};

export interface ListarDocumentosContratuaisClientePort {
  // Alterações do maior nº para o menor, contrato social por último: o primeiro item é o vigente.
  execute(clienteId: string): Promise<Result<DocumentoContratualVisivelDto[], AppError>>;
}

export type ObterLinkDocumentoContratualInput = {
  clienteId: string;
  tipo: TipoDocumentoContratual;
  numero: number | null;
};

export interface ObterLinkDocumentoContratualPort {
  execute(entrada: ObterLinkDocumentoContratualInput): Promise<Result<{ url: string }, AppError>>;
}
