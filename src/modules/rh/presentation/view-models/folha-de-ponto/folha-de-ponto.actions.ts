"use server";

import type { z } from "zod";

import {
  makeBaixarPdfDoCartao,
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
  baixarPdfDoCartaoSchema,
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

type PdfDoCartaoBaixado = { nomeDoArquivo: string; base64: string };

export async function baixarPdfDoCartaoAction(
  input: unknown,
): Promise<ActionResult<PdfDoCartaoBaixado>> {
  const parsed = baixarPdfDoCartaoSchema.safeParse(input);
  if (!parsed.success) return dadosInvalidos(parsed.error);
  const resultado = await (await makeBaixarPdfDoCartao()).execute(parsed.data);
  if (!resultado.ok) return toActionResult(resultado);
  const { nomeDoArquivo, bytes } = resultado.value;
  return { ok: true, data: { nomeDoArquivo, base64: Buffer.from(bytes).toString("base64") } };
}

export async function iniciarCartaoDoPontoAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = iniciarCartaoSchema.safeParse(input);
  if (!parsed.success) return dadosInvalidos(parsed.error);
  return toActionResult(await (await makeIniciarCartaoDoPonto()).execute(parsed.data));
}

async function bytesDaImagem(imagem: File): Promise<FotoDoPonto> {
  const bytes = new Uint8Array(await imagem.arrayBuffer());
  return { bytes, tipo: tipoDaFoto(bytes) ?? (imagem.type as TipoDeFoto) };
}

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
