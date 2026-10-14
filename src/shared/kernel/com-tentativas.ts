import type { AppError } from "@/shared/errors/app.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import type { Result } from "@/shared/kernel/result";

export const TENTATIVAS = 3;
export const ESPERA_MS = 2000;

// Só falha do serviço externo é transitória; o resto (sem autorização, destinatário inválido)
// não melhora ao repetir.
const transitoria = (resultado: Result<unknown, AppError>) =>
  !resultado.ok && resultado.error instanceof ServicoExternoError;

export async function comTentativas<T>(
  operacao: () => Promise<Result<T, AppError>>,
  tentativas: number,
  esperaMs: number,
): Promise<Result<T, AppError>> {
  let resultado = await operacao();
  for (let n = 1; n < tentativas && transitoria(resultado); n += 1) {
    await new Promise((resolve) => setTimeout(resolve, esperaMs));
    resultado = await operacao();
  }
  return resultado;
}
