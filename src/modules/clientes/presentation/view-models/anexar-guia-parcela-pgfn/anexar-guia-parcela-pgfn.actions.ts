"use server";

import { z } from "zod";

import {
  makeAnexarGuiaParcelaPgfn,
  makeConfirmarGuiaParcelaPgfn,
  makeListarGuiasParcelaPgfn,
} from "@/main/clientes.factory";
import type { GuiaDaParcela } from "@/modules/clientes/application/ports/out/guia-parcela-pgfn.repository";
import {
  anexarGuiaParcelaPgfnSchema,
  confirmarGuiaParcelaPgfnSchema,
} from "@/modules/clientes/presentation/view-models/anexar-guia-parcela-pgfn/anexar-guia-parcela-pgfn.schema";
import type { ActionResult } from "@/shared/dtos/action-result.dto";
import { toActionResult } from "@/shared/kernel/to-action-result";

const dadosInvalidos = (erro: z.ZodError): ActionResult<never> => ({
  ok: false,
  error: {
    code: "VALIDATION_ERROR",
    message: "Dados inválidos.",
    fields: z.flattenError(erro).fieldErrors as Record<string, string[]>,
  },
});

export async function anexarGuiaParcelaPgfnAction(
  input: unknown,
): Promise<ActionResult<GuiaDaParcela>> {
  const parsed = anexarGuiaParcelaPgfnSchema.safeParse(input);
  if (!parsed.success) return dadosInvalidos(parsed.error);

  const anexar = await makeAnexarGuiaParcelaPgfn();
  return toActionResult(await anexar.execute(parsed.data));
}

export async function confirmarGuiaParcelaPgfnAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = confirmarGuiaParcelaPgfnSchema.safeParse(input);
  if (!parsed.success) return dadosInvalidos(parsed.error);

  const confirmar = await makeConfirmarGuiaParcelaPgfn();
  return toActionResult(await confirmar.execute(parsed.data));
}

export async function listarGuiasParcelaPgfnAction(
  input: unknown,
): Promise<ActionResult<GuiaDaParcela[]>> {
  const parsed = z.object({ parcelamentoId: z.guid() }).safeParse(input);
  if (!parsed.success) return dadosInvalidos(parsed.error);

  const listar = await makeListarGuiasParcelaPgfn();
  return toActionResult(await listar.execute(parsed.data.parcelamentoId));
}
