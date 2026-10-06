import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// Envia o texto ao cliente e, só se ele foi de fato entregue, guarda como Mensagem da URA no
// Atendimento em andamento do número (`chave`).
export interface AvisarClientePort {
  execute(input: {
    telefone: string;
    chave: string;
    texto: string;
  }): Promise<Result<void, AppError>>;
}
