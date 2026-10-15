"use server";

import { makeListarMeusAtendimentos } from "@/main/atendimento.factory";
import type { AtendimentoVisto } from "@/modules/atendimento/application/ports/in/listar-meus-atendimentos.provider";
import type { ActionResult } from "@/shared/dtos/action-result.dto";
import { toActionResult } from "@/shared/kernel/to-action-result";

export async function listarMeusAtendimentosAction(): Promise<ActionResult<AtendimentoVisto[]>> {
  const listarMeusAtendimentos = await makeListarMeusAtendimentos();
  return toActionResult(await listarMeusAtendimentos.execute());
}
