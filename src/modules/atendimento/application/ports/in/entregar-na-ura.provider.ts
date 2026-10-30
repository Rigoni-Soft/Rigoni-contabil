import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// Pedido de uma guia pelo menu da URA. Já responde ao contato (avisos ou o PDF); o erro devolvido é
// de falha da guia e quem chama decide a resposta.
export type EntregarNaUraInput = { clienteId: string; telefone: string };

export interface EntregarNaUraPort {
  execute(pedido: EntregarNaUraInput): Promise<Result<void, AppError>>;
}
