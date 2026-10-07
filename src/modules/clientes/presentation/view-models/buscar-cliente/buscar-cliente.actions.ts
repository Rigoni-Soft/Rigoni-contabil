"use server";

import { z } from "zod";

import {
  makeBuscarClientes,
  makeConsultarCadastroOperacionalCliente,
} from "@/main/clientes.factory";
import type {
  CadastroOperacionalClienteDto,
  SugestaoClienteDto,
} from "@/modules/clientes/application/ports/out/cliente-query.provider";
import { buscarClienteSchema } from "@/modules/clientes/presentation/view-models/buscar-cliente/buscar-cliente.schema";
import type { ActionResult } from "@/shared/dtos/action-result.dto";
import { toActionResult } from "@/shared/kernel/to-action-result";

export async function buscarClientesAction(
  input: unknown,
): Promise<ActionResult<SugestaoClienteDto[]>> {
  const parsed = buscarClienteSchema.safeParse(input);
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

  const buscar = await makeBuscarClientes();
  return toActionResult(await buscar.execute(parsed.data.termo, parsed.data.apenasSnMei));
}

// Server Action é endpoint público (arquitetura.md §3.13): o clienteId é validado mesmo vindo
// de um resultado de busca da própria UI.
export async function carregarCadastroOperacionalAction(
  clienteId: unknown,
): Promise<ActionResult<CadastroOperacionalClienteDto | null>> {
  const parsed = z.guid().safeParse(clienteId);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION_ERROR", message: "Cliente inválido." } };
  }

  const consultar = await makeConsultarCadastroOperacionalCliente();
  return toActionResult(await consultar.execute(parsed.data));
}
