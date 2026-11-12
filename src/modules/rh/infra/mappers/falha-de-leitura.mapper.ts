import { z } from "zod";

import type { RegistroDeErrosPort } from "@/modules/rh/application/ports/out/registro-de-erros.provider";
import type { AppError } from "@/shared/errors/app.error";
import { PersistenciaError } from "@/shared/errors/persistencia.error";
import { err, ok, type Result } from "@/shared/kernel/result";

// Os repositórios do RH leem do banco do mesmo jeito: a falha vai para o registro de erros e o chamador
// recebe só a mensagem amigável do repositório.
export type FalhaDeLeitura = { registro: string; mensagem: string; erros: RegistroDeErrosPort };

export function falhaDeLeitura(
  { registro, mensagem, erros }: FalhaDeLeitura,
  error: { message: string },
): Result<never, AppError> {
  erros.registrar(registro, error.message);
  return err(new PersistenciaError(mensagem));
}

// A linha que o banco devolveu fora do formato esperado também é falha de leitura.
export function lerLinhas<S extends z.ZodType>(
  falha: FalhaDeLeitura,
  schema: S,
  data: unknown,
): Result<z.output<S>, AppError> {
  const lido = schema.safeParse(data);
  return lido.success
    ? ok(lido.data)
    : falhaDeLeitura(falha, { message: z.prettifyError(lido.error) });
}
