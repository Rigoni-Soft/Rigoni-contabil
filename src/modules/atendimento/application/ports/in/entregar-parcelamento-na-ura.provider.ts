import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// Pedido da guia de parcelamento pelo menu da URA. Já responde ao contato (avisos ou os PDFs); o
// erro devolvido é de falha da guia (sem autorização, provedor fora do ar) e quem chama decide a
// resposta.
export type EntregarParcelamentoNaUraInput = { clienteId: string; telefone: string };

export interface EntregarParcelamentoNaUraPort {
  execute(pedido: EntregarParcelamentoNaUraInput): Promise<Result<void, AppError>>;
}
