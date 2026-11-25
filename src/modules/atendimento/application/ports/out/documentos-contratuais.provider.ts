import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type DocumentoContratual = {
  tipo: "contrato" | "alteracao";
  numero: number | null;
  data: string | null;
  caminho: string;
};

export interface DocumentosContratuaisPort {
  listar(clienteId: string): Promise<Result<DocumentoContratual[], AppError>>;
  linkTemporario(caminho: string): Promise<Result<string, AppError>>;
}
