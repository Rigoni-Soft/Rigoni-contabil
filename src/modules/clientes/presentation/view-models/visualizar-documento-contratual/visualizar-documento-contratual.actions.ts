"use server";

import { z } from "zod";

import {
  makeListarDocumentosContratuaisCliente,
  makeObterLinkDocumentoContratual,
} from "@/main/clientes.factory";
import type { DocumentoContratualVisivelDto } from "@/modules/clientes/application/ports/in/documentos-contratuais-cliente.provider";
import type { ActionResult } from "@/shared/dtos/action-result.dto";
import { toActionResult } from "@/shared/kernel/to-action-result";

const schema = z.discriminatedUnion("tipo", [
  z.object({ clienteId: z.guid(), tipo: z.literal("contrato"), numero: z.null() }),
  z.object({
    clienteId: z.guid(),
    tipo: z.literal("alteracao"),
    numero: z.number().int().positive(),
  }),
]);

export async function obterLinkDocumentoContratualAction(
  input: unknown,
): Promise<ActionResult<{ url: string }>> {
  const parsed = schema.safeParse(input);
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
  const obter = await makeObterLinkDocumentoContratual();
  return toActionResult(await obter.execute(parsed.data));
}

export async function listarDocumentosContratuaisAction(
  clienteId: unknown,
): Promise<ActionResult<DocumentoContratualVisivelDto[]>> {
  const parsed = z.guid().safeParse(clienteId);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION_ERROR", message: "Cliente inválido." } };
  }
  const listar = await makeListarDocumentosContratuaisCliente();
  return toActionResult(await listar.execute(parsed.data));
}
