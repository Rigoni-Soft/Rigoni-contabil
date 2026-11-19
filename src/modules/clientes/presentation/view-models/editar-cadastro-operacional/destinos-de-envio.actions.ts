"use server";

import { z } from "zod";

import { makeDefinirDestinoDeEnvio, makeRemoverDestinoDeEnvio } from "@/main/clientes.factory";
import type { ActionResult } from "@/shared/dtos/action-result.dto";
import { toActionResult } from "@/shared/kernel/to-action-result";

import { definirDestinoSchema, removerDestinoSchema } from "./destinos-de-envio.schema";

const entradaInvalida = (erro: z.ZodError): ActionResult<never> => ({
  ok: false,
  error: {
    code: "VALIDATION_ERROR",
    message: "Dados inválidos.",
    fields: z.flattenError(erro).fieldErrors as Record<string, string[]>,
  },
});

// O "Adicionar" do formulário de destino: grava na hora o Destino do Setor (e o contato novo, junto).
export async function definirDestinoAction(
  input: unknown,
): Promise<ActionResult<{ destinoId: string; contatoId: string }>> {
  const parsed = definirDestinoSchema.safeParse(input);
  if (!parsed.success) return entradaInvalida(parsed.error);

  const definir = await makeDefinirDestinoDeEnvio();
  return toActionResult(await definir.execute(parsed.data));
}

export async function removerDestinoAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = removerDestinoSchema.safeParse(input);
  if (!parsed.success) return entradaInvalida(parsed.error);

  const remover = await makeRemoverDestinoDeEnvio();
  return toActionResult(await remover.execute(parsed.data));
}
