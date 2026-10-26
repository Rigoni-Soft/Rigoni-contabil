"use server";

import { z } from "zod";

import {
  makeAnexarGuiaParcelaPgfn,
  makeConfirmarGuiaParcelaPgfn,
  makeListarGuiasParcelaPgfn,
  makeObterLinkGuiaParcelaPgfn,
  makeRemoverGuiaParcelaPgfn,
  makeTrocarGuiaParcelaPgfn,
} from "@/main/clientes.factory";
import type { GuiaDaParcela } from "@/modules/clientes/application/ports/out/guia-parcela-pgfn.repository";
import {
  anexarGuiaParcelaPgfnSchema,
  confirmarGuiaParcelaPgfnSchema,
  guiaDaParcelaPgfnSchema,
  trocarGuiaParcelaPgfnSchema,
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
  const pdf = new Uint8Array(await parsed.data.arquivo.arrayBuffer());
  return toActionResult(await anexar.execute({ ...parsed.data, pdf }));
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

export async function trocarGuiaParcelaPgfnAction(
  input: unknown,
): Promise<ActionResult<GuiaDaParcela>> {
  const parsed = trocarGuiaParcelaPgfnSchema.safeParse(input);
  if (!parsed.success) return dadosInvalidos(parsed.error);

  const trocar = await makeTrocarGuiaParcelaPgfn();
  const pdf = new Uint8Array(await parsed.data.arquivo.arrayBuffer());
  return toActionResult(await trocar.execute({ ...parsed.data, pdf }));
}

export async function removerGuiaParcelaPgfnAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = guiaDaParcelaPgfnSchema.safeParse(input);
  if (!parsed.success) return dadosInvalidos(parsed.error);

  const remover = await makeRemoverGuiaParcelaPgfn();
  return toActionResult(await remover.execute(parsed.data));
}

export async function obterLinkGuiaParcelaPgfnAction(
  input: unknown,
): Promise<ActionResult<{ url: string }>> {
  const parsed = guiaDaParcelaPgfnSchema.safeParse(input);
  if (!parsed.success) return dadosInvalidos(parsed.error);

  const obterLink = await makeObterLinkGuiaParcelaPgfn();
  return toActionResult(await obterLink.execute(parsed.data));
}
