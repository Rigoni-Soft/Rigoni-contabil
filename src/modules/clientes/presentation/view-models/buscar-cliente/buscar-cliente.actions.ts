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
  return toActionResult(await buscar.execute(parsed.data.termo));
}

// Sem schema de validação de input: clienteId já vem de um resultado de busca
// confiável (buscarClientesAction), não de digitação direta do usuário.
export async function carregarCadastroOperacionalAction(
  clienteId: string,
): Promise<ActionResult<CadastroOperacionalClienteDto | null>> {
  const consultar = await makeConsultarCadastroOperacionalCliente();
  return toActionResult(await consultar.execute(clienteId));
}
