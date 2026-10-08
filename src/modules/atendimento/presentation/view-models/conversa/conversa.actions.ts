"use server";

import { z } from "zod";

import { makeEnviarDocumentoAoCliente, makeObterConversa } from "@/main/atendimento.factory";
import type { ConversaVista } from "@/modules/atendimento/application/ports/in/obter-conversa.provider";
import {
  atendimentoIdSchema,
  enviarDocumentoSchema,
} from "@/modules/atendimento/presentation/view-models/conversa/conversa.schema";
import type { ActionResult } from "@/shared/dtos/action-result.dto";
import { toActionResult } from "@/shared/kernel/to-action-result";

function entradaInvalida(erro: z.ZodError): ActionResult<never> {
  return {
    ok: false,
    error: {
      code: "VALIDATION_ERROR",
      message: "Dados inválidos.",
      fields: z.flattenError(erro).fieldErrors as Record<string, string[]>,
    },
  };
}

export async function obterConversaAction(
  atendimentoId: unknown,
): Promise<ActionResult<ConversaVista>> {
  const parsed = atendimentoIdSchema.safeParse(atendimentoId);
  if (!parsed.success) return entradaInvalida(parsed.error);

  const obterConversa = await makeObterConversa();
  return toActionResult(await obterConversa.execute({ atendimentoId: parsed.data }));
}

export async function enviarDocumentoAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = enviarDocumentoSchema.safeParse(input);
  if (!parsed.success) return entradaInvalida(parsed.error);

  const enviarDocumento = await makeEnviarDocumentoAoCliente();
  return toActionResult(await enviarDocumento.execute(parsed.data));
}
