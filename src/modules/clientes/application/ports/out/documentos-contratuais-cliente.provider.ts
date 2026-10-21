import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// Contrato social (sem nº/data) ou alteração contratual do Cliente. O caminho do objeto fica no
// servidor: o caso de uso o descarta antes de a tela receber qualquer coisa.
export type DocumentoContratualClienteDto = {
  tipo: "contrato" | "alteracao";
  numero: number | null;
  data: string | null;
  caminho: string;
};

// Sessão do usuário (RLS), nunca service_role. Lista vazia = sem acesso ou sem documentos.
export interface DocumentosContratuaisClientePort {
  listar(clienteId: string): Promise<Result<DocumentoContratualClienteDto[], AppError>>;
  linkTemporario(caminho: string, validadeSegundos: number): Promise<Result<string, AppError>>;
}
