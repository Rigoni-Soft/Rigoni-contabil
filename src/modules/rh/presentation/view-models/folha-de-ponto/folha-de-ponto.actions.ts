"use server";

import type { z } from "zod";

import {
  makeCadastrarEmpregado,
  makeCorrigirEmpregado,
  makeDefinirEmpregadoAtivo,
  makeDefinirPadraoComissionados,
  makeDefinirSemMovimento,
  makeIniciarCartaoDoPonto,
  makeLerAtestadoDePonto,
  makeLerCartaoDePonto,
  makeSalvarDiaDoPonto,
} from "@/main/rh.factory";
import type { AtestadoLidoDto } from "@/modules/rh/application/ports/in/ler-atestado-de-ponto.provider";
import type { CartaoLidoDto } from "@/modules/rh/application/ports/in/ler-cartao-de-ponto.provider";
import { dadosInvalidos } from "@/modules/rh/presentation/view-models/dados-invalidos.presenter";
import type { ActionResult } from "@/shared/dtos/action-result.dto";
import { tipoDaFoto, type FotoDoPonto, type TipoDeFoto } from "@/shared/kernel/foto-do-ponto";
import { toActionResult } from "@/shared/kernel/to-action-result";

import {
  cadastrarEmpregadoSchema,
  corrigirEmpregadoSchema,
  empregadoAtivoSchema,
  iniciarCartaoSchema,
  lerAtestadoSchema,
  lerCartaoSchema,
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

// A foto chega como File no FormData; o caso de uso recebe só os bytes (a porta não conhece a web) e a
// imagem não é guardada em lugar nenhum. O tipo sai da assinatura do arquivo, não do `File.type` do navegador;
// arquivo que não é JPEG nem PNG segue com o tipo declarado e o caso de uso o recusa.
async function bytesDaImagem(imagem: File): Promise<FotoDoPonto> {
  const bytes = new Uint8Array(await imagem.arrayBuffer());
  return { bytes, tipo: tipoDaFoto(bytes) ?? (imagem.type as TipoDeFoto) };
}

// Erro da foto vira mensagem do próprio campo; o resto é dado inválido.
function recusaDaLeitura(erro: z.ZodError): ActionResult<never> {
  const foto = erro.issues.find((i) => i.path[0] === "imagem");
  return foto
    ? { ok: false, error: { code: "VALIDATION_ERROR", message: foto.message } }
    : dadosInvalidos(erro);
}

export async function lerCartaoDePontoAction(
  formData: FormData,
): Promise<ActionResult<CartaoLidoDto>> {
  const parsed = lerCartaoSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return recusaDaLeitura(parsed.error);
  const { imagem, ...dados } = parsed.data;
  return toActionResult(
    await (await makeLerCartaoDePonto()).execute({ ...dados, imagem: await bytesDaImagem(imagem) }),
  );
}

// Como a do cartão: a foto do atestado só passa pelo leitor; nada dela é guardado.
export async function lerAtestadoDePontoAction(
  formData: FormData,
): Promise<ActionResult<AtestadoLidoDto>> {
  const parsed = lerAtestadoSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return recusaDaLeitura(parsed.error);
  const { imagem, ...dados } = parsed.data;
  return toActionResult(
    await (
      await makeLerAtestadoDePonto()
    ).execute({ ...dados, imagem: await bytesDaImagem(imagem) }),
  );
}
