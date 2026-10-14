import type { AppError } from "@/shared/errors/app.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import type { Result } from "@/shared/kernel/result";

// Só falha do serviço externo é transitória; o resto (sem autorização, destinatário inválido)
// não melhora ao repetir.
export async function comTentativas<T>(
  operacao: () => Promise<Result<T, AppError>>,
  tentativas: number,
  esperaMs: number,
): Promise<Result<T, AppError>> {
  let resultado = await operacao();
  for (let n = 1; n < tentativas && !resultado.ok; n += 1) {
    if (!(resultado.error instanceof ServicoExternoError)) break;
    await new Promise((resolve) => setTimeout(resolve, esperaMs));
    resultado = await operacao();
  }
  return resultado;
}
