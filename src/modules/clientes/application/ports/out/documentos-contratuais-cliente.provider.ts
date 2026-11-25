import type { TipoDocumentoContratual } from "@/modules/clientes/application/dtos/tipo-documento-contratual.dto";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type DocumentoContratualClienteDto = {
  tipo: TipoDocumentoContratual;
  numero: number | null;
  data: string | null;
  caminho: string;
};

export interface DocumentosContratuaisClientePort {
  listar(clienteId: string): Promise<Result<DocumentoContratualClienteDto[], AppError>>;
  linkTemporario(caminho: string, validadeSegundos: number): Promise<Result<string, AppError>>;
}
