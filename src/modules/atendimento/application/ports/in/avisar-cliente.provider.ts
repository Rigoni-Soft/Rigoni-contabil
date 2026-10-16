import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// Envia o texto ao cliente e, só se ele foi de fato entregue, guarda como Mensagem da URA no
// Atendimento em andamento do número (`chave`). `registrar: false` só envia: a Mensagem já está no
// histórico (o aviso final de um encerramento, gravado na transação que fechou).
export interface AvisarClientePort {
  execute(input: {
    telefone: string;
    chave: string;
    texto: string;
    registrar?: boolean;
  }): Promise<Result<void, AppError>>;
}
