"use server";

import { z } from "zod";

import {
  makeDefinirConvencaoDoEmpregado,
  makeDefinirInterruptoresDoCliente,
  makeEnviarConvencao,
} from "@/main/rh.factory";
import type { ActionResult } from "@/shared/dtos/action-result.dto";
import { toActionResult } from "@/shared/kernel/to-action-result";

import {
  convencaoDoEmpregadoSchema,
  enviarConvencaoSchema,
  interruptoresSchema,
} from "./convencao.schema";

function invalido(erro: z.ZodError): ActionResult<void> {
  return {
    ok: false,
    error: {
      code: "VALIDATION_ERROR",
      message: "Dados inválidos.",
      fields: z.flattenError(erro).fieldErrors as Record<string, string[]>,
    },
  };
}

// O PDF chega como File no FormData; o caso de uso recebe só os bytes (a porta não conhece a web).
export async function enviarConvencaoAction(formData: FormData): Promise<ActionResult<void>> {
  const parsed = enviarConvencaoSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const arquivo = parsed.error.issues.find((i) => i.path[0] === "arquivo");
    return arquivo
      ? { ok: false, error: { code: "VALIDATION_ERROR", message: arquivo.message } }
      : invalido(parsed.error);
  }
  const { arquivo, ...dados } = parsed.data;
  const enviar = await makeEnviarConvencao();
  return toActionResult(
    await enviar.execute({
      ...dados,
      arquivo: { nome: arquivo.name, bytes: new Uint8Array(await arquivo.arrayBuffer()) },
    }),
  );
}

export async function definirInterruptoresAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = interruptoresSchema.safeParse(input);
  if (!parsed.success) return invalido(parsed.error);
  return toActionResult(await (await makeDefinirInterruptoresDoCliente()).execute(parsed.data));
}

export async function definirConvencaoDoEmpregadoAction(
  input: unknown,
): Promise<ActionResult<void>> {
  const parsed = convencaoDoEmpregadoSchema.safeParse(input);
  if (!parsed.success) return invalido(parsed.error);
  return toActionResult(await (await makeDefinirConvencaoDoEmpregado()).execute(parsed.data));
}
