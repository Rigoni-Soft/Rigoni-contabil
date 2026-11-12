"use server";

import {
  makeCadastrarEmpregado,
  makeCorrigirEmpregado,
  makeDefinirEmpregadoAtivo,
  makeDefinirPadraoComissionados,
  makeDefinirSemMovimento,
  makeIniciarCartaoDoPonto,
  makeSalvarDiaDoPonto,
} from "@/main/rh.factory";
import type { ActionResult } from "@/shared/dtos/action-result.dto";
import { toActionResult } from "@/shared/kernel/to-action-result";
import { dadosInvalidos } from "@/modules/rh/presentation/view-models/dados-invalidos.presenter";

import {
  cadastrarEmpregadoSchema,
  corrigirEmpregadoSchema,
  empregadoAtivoSchema,
  iniciarCartaoSchema,
  padraoComissionadosSchema,
  salvarDiaSchema,
  semMovimentoSchema,
} from "./folha-de-ponto.schema";

export async function cadastrarEmpregadoAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = cadastrarEmpregadoSchema.safeParse(input);
  if (!parsed.success) return dadosInvalidos(parsed.error);
  return toActionResult(await (await makeCadastrarEmpregado()).execute(parsed.data));
}

export async function corrigirEmpregadoAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = corrigirEmpregadoSchema.safeParse(input);
  if (!parsed.success) return dadosInvalidos(parsed.error);
  return toActionResult(await (await makeCorrigirEmpregado()).execute(parsed.data));
}

export async function definirEmpregadoAtivoAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = empregadoAtivoSchema.safeParse(input);
  if (!parsed.success) return dadosInvalidos(parsed.error);
  return toActionResult(await (await makeDefinirEmpregadoAtivo()).execute(parsed.data));
}

export async function definirSemMovimentoAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = semMovimentoSchema.safeParse(input);
  if (!parsed.success) return dadosInvalidos(parsed.error);
  return toActionResult(await (await makeDefinirSemMovimento()).execute(parsed.data));
}

export async function definirPadraoComissionadosAction(
  input: unknown,
): Promise<ActionResult<void>> {
  const parsed = padraoComissionadosSchema.safeParse(input);
  if (!parsed.success) return dadosInvalidos(parsed.error);
  return toActionResult(await (await makeDefinirPadraoComissionados()).execute(parsed.data));
}

export async function salvarDiaDoPontoAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = salvarDiaSchema.safeParse(input);
  if (!parsed.success) return dadosInvalidos(parsed.error);
  return toActionResult(await (await makeSalvarDiaDoPonto()).execute(parsed.data));
}

export async function iniciarCartaoDoPontoAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = iniciarCartaoSchema.safeParse(input);
  if (!parsed.success) return dadosInvalidos(parsed.error);
  return toActionResult(await (await makeIniciarCartaoDoPonto()).execute(parsed.data));
}
