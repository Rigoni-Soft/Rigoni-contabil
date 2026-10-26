import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// Pedido do DAS pelo menu da URA. Já responde ao contato (aviso de indisponível ou o PDF); o erro
// devolvido é de falha da guia e quem chama decide a resposta.
export type EntregarDasNaUraInput = { clienteId: string; telefone: string };

export interface EntregarDasNaUraPort {
  execute(pedido: EntregarDasNaUraInput): Promise<Result<void, AppError>>;
}
