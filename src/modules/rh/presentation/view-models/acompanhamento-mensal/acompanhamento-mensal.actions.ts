"use server";

import {
  makeCriarServicoAcompanhamento,
  makeDefinirServicoAplicavel,
  makeDesativarServicoAcompanhamento,
  makeMarcarServicoAcompanhamento,
  makeRenomearServicoAcompanhamento,
} from "@/main/rh.factory";
import type { ActionResult } from "@/shared/dtos/action-result.dto";
import { toActionResult } from "@/shared/kernel/to-action-result";
import { dadosInvalidos } from "@/modules/rh/presentation/view-models/dados-invalidos.presenter";

import {
  aplicaSchema,
  marcarSchema,
  nomeServicoSchema,
  servicoSchema,
} from "./acompanhamento-mensal.schema";

export async function marcarServicoAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = marcarSchema.safeParse(input);
  if (!parsed.success) return dadosInvalidos(parsed.error);
  return toActionResult(await (await makeMarcarServicoAcompanhamento()).execute(parsed.data));
}

export async function definirServicoAplicavelAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = aplicaSchema.safeParse(input);
  if (!parsed.success) return dadosInvalidos(parsed.error);
  return toActionResult(await (await makeDefinirServicoAplicavel()).execute(parsed.data));
}

export async function criarServicoAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = nomeServicoSchema.safeParse(input);
  if (!parsed.success) return dadosInvalidos(parsed.error);
  return toActionResult(await (await makeCriarServicoAcompanhamento()).execute(parsed.data));
}

export async function renomearServicoAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = servicoSchema.extend(nomeServicoSchema.shape).safeParse(input);
  if (!parsed.success) return dadosInvalidos(parsed.error);
  return toActionResult(await (await makeRenomearServicoAcompanhamento()).execute(parsed.data));
}

export async function desativarServicoAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = servicoSchema.safeParse(input);
  if (!parsed.success) return dadosInvalidos(parsed.error);
  return toActionResult(await (await makeDesativarServicoAcompanhamento()).execute(parsed.data));
}
