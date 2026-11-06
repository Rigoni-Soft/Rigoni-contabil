"use server";

import { z } from "zod";

import { makeLerPdfDeParcelamento } from "@/main/clientes.factory";
import type { SugestaoDeParcelamento } from "@/modules/clientes/application/ports/in/ler-pdf-de-parcelamento.provider";
import { lerPdfDeParcelamentoSchema } from "@/modules/clientes/presentation/view-models/editar-cadastro-operacional/editar-cadastro-operacional.schema";
import type { ActionResult } from "@/shared/dtos/action-result.dto";
import { toActionResult } from "@/shared/kernel/to-action-result";

export async function lerPdfDeParcelamentoAction(
  input: unknown,
): Promise<ActionResult<SugestaoDeParcelamento>> {
  const parsed = lerPdfDeParcelamentoSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dados inválidos.",
        fields: z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
      },
    };
  }

  const ler = await makeLerPdfDeParcelamento();
  const pdf = new Uint8Array(await parsed.data.arquivo.arrayBuffer());
  return toActionResult(await ler.execute({ pdf, clienteId: parsed.data.clienteId }));
}
