"use server";

import { z } from "zod";

import {
  makeListarDocumentosContratuaisCliente,
  makeObterLinkDocumentoContratual,
} from "@/main/clientes.factory";
import type { DocumentoContratualVisivelDto } from "@/modules/clientes/application/ports/in/documentos-contratuais-cliente.provider";
import type { ActionResult } from "@/shared/dtos/action-result.dto";
import { toActionResult } from "@/shared/kernel/to-action-result";

// guid, não uuid: ids do seed não são v4 (mesmo motivo de atribuir-responsavel.actions).
const schema = z.discriminatedUnion("tipo", [
  z.object({ clienteId: z.guid(), tipo: z.literal("contrato"), numero: z.null() }),
  z.object({
    clienteId: z.guid(),
    tipo: z.literal("alteracao"),
    numero: z.number().int().positive(),
  }),
]);

// O link nasce no clique (validade de 120 s); a tela só informa {tipo, número}, nunca o caminho.
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

// Server Action é endpoint público (arquitetura.md §3.13): o clienteId é validado mesmo vindo da UI.
// Lista vazia = ator sem acesso ao documento (ou Cliente sem documentos): a tela não mostra o botão.
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
