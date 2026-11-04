import { AppError } from "@/shared/errors/app.error";

// Falha ao ler do banco numa consulta (gateways de leitura).
export class ConsultaError extends AppError {
  readonly code = "CONSULTA_ERROR";
}
