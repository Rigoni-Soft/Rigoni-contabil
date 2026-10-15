"use server";

import { z } from "zod";

import {
  makeEncerrarAtendimento,
  makeEnviarAnexoAoCliente,
  makeEnviarDocumentoAoCliente,
  makeEnviarMensagemAoCliente,
  makeObterConversa,
  makeReagirAMensagem,
  makeTransferirAtendimento,
} from "@/main/atendimento.factory";
import type { AtendimentoEncerrado } from "@/modules/atendimento/application/ports/in/encerrar-atendimento.provider";
import type { ConversaVista } from "@/modules/atendimento/application/ports/in/obter-conversa.provider";
import type { TransferenciaConcluida } from "@/modules/atendimento/application/ports/in/transferir-atendimento.provider";
import {
  atendimentoIdSchema,
  enviarAnexoGuardadoSchema,
  enviarDocumentoSchema,
  enviarMensagemSchema,
  reagirAMensagemSchema,
  transferirAtendimentoSchema,
} from "@/modules/atendimento/presentation/view-models/conversa/conversa.schema";
import type { ActionResult } from "@/shared/dtos/action-result.dto";
import { toActionResult } from "@/shared/kernel/to-action-result";

function entradaInvalida(erro: z.ZodError): ActionResult<never> {
  return {
    ok: false,
    error: {
      code: "VALIDATION_ERROR",
      message: "Dados inválidos.",
      fields: z.flattenError(erro).fieldErrors as Record<string, string[]>,
    },
  };
}

export async function obterConversaAction(
  atendimentoId: unknown,
): Promise<ActionResult<ConversaVista>> {
  const parsed = atendimentoIdSchema.safeParse(atendimentoId);
  if (!parsed.success) return entradaInvalida(parsed.error);

  const obterConversa = await makeObterConversa();
  return toActionResult(await obterConversa.execute({ atendimentoId: parsed.data }));
}

export async function enviarDocumentoAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = enviarDocumentoSchema.safeParse(input);
  if (!parsed.success) return entradaInvalida(parsed.error);

  const enviarDocumento = await makeEnviarDocumentoAoCliente();
  return toActionResult(await enviarDocumento.execute(parsed.data));
}

export async function transferirAtendimentoAction(
  input: unknown,
): Promise<ActionResult<TransferenciaConcluida>> {
  const parsed = transferirAtendimentoSchema.safeParse(input);
  if (!parsed.success) return entradaInvalida(parsed.error);

  const transferir = await makeTransferirAtendimento();
  return toActionResult(await transferir.execute(parsed.data));
}

export async function encerrarAtendimentoAction(
  atendimentoId: unknown,
): Promise<ActionResult<AtendimentoEncerrado>> {
  const parsed = atendimentoIdSchema.safeParse(atendimentoId);
  if (!parsed.success) return entradaInvalida(parsed.error);

  const encerrar = await makeEncerrarAtendimento();
  return toActionResult(await encerrar.execute({ atendimentoId: parsed.data }));
}

export async function enviarMensagemAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = enviarMensagemSchema.safeParse(input);
  if (!parsed.success) return entradaInvalida(parsed.error);

  const enviarMensagem = await makeEnviarMensagemAoCliente();
  return toActionResult(await enviarMensagem.execute(parsed.data));
}

export async function reagirAMensagemAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = reagirAMensagemSchema.safeParse(input);
  if (!parsed.success) return entradaInvalida(parsed.error);

  const reagir = await makeReagirAMensagem();
  return toActionResult(await reagir.execute(parsed.data));
}

// O navegador já subiu o objeto em partes direto ao Storage (o corpo de uma Server Action não passa
// de 4,5 MB na Vercel); aqui chegam só o caminho, o nome, a legenda e a miniatura (até 256 KB).
export async function enviarAnexoGuardadoAction(formData: FormData): Promise<ActionResult<void>> {
  const parsed = enviarAnexoGuardadoSchema.safeParse({
    atendimentoId: formData.get("atendimentoId"),
    caminho: formData.get("caminho"),
    nome: formData.get("nome"),
    legenda: formData.get("legenda") ?? undefined,
  });
  if (!parsed.success) return entradaInvalida(parsed.error);

  const miniatura = formData.get("miniatura");
  const enviarAnexo = await makeEnviarAnexoAoCliente();
  return toActionResult(
    await enviarAnexo.execute({
      atendimentoId: parsed.data.atendimentoId,
      legenda: parsed.data.legenda,
      guardado: { caminho: parsed.data.caminho, nome: parsed.data.nome },
      miniatura:
        miniatura instanceof File
          ? {
              nome: miniatura.name,
              tipoMime: miniatura.type,
              conteudo: new Uint8Array(await miniatura.arrayBuffer()),
            }
          : undefined,
    }),
  );
}
