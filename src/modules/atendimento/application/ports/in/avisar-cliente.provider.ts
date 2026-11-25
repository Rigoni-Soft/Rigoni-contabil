import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export interface AvisarClientePort {
  execute(input: {
    telefone: string;
    chave: string;
    texto: string;
    registrar?: boolean;
  }): Promise<Result<void, AppError>>;
}
