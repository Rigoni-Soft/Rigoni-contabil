import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// Resposta em texto do Funcionário ao cliente do Atendimento, entregue no WhatsApp e guardada
// como Mensagem do Funcionário (nome e Setor no balão).
export interface EnviarMensagemAoClientePort {
  execute(input: { atendimentoId: string; texto: string }): Promise<Result<void, AppError>>;
}
