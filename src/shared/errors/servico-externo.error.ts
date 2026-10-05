import { AppError } from "@/shared/errors/app.error";

// Falha de um serviço de terceiros (ex.: Serpro): esperada, tratada como
// erro de domínio pra nunca derrubar o resto do sistema.
export class ServicoExternoError extends AppError {
  readonly code = "EXTERNAL_SERVICE_ERROR";
}
