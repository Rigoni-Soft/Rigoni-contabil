import { z } from "zod";

import {
  makeAutenticarWebhook,
  makeReceberMensagem,
  makeReceberMidia,
  makeRegistroDeErros,
} from "@/main/atendimento.factory";
import {
  classificarMensagem,
  mensagemSchema,
} from "@/modules/atendimento/presentation/webhooks/mensagem-recebida.webhook";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";

const notificacaoSchema = z.object({
  object: z.literal("whatsapp_business_account"),
  entry: z.array(
    z.object({
      changes: z.array(
        z.object({
          field: z.string(),
          value: z.object({
            messages: z.array(mensagemSchema).optional(),
          }),
        }),
      ),
    }),
  ),
});

const resposta = (corpo: string, status: number) => new Response(corpo, { status });

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const modo = params.get("hub.mode");
  const challenge = params.get("hub.challenge");
  const token = params.get("hub.verify_token");
  if (!modo || !challenge || !token) return resposta("Parâmetros hub.* ausentes.", 400);
  if (modo !== "subscribe" || !makeAutenticarWebhook().verificarToken(token).ok) {
    return resposta("Verificação recusada.", 403);
  }
  return resposta(challenge, 200);
}

export async function POST(request: Request): Promise<Response> {
  const corpoCru = await request.text();
  const assinatura = request.headers.get("x-hub-signature-256");
  if (!makeAutenticarWebhook().verificarAssinatura(corpoCru, assinatura).ok) {
    return resposta("Assinatura inválida.", 403);
  }

  let json: unknown;
  try {
    json = JSON.parse(corpoCru);
  } catch {
    return resposta("Corpo não é JSON.", 400);
  }
  const notificacao = notificacaoSchema.safeParse(json);
  if (!notificacao.success) return resposta("Corpo fora do formato da Cloud API.", 400);

  const receber = await makeReceberMensagem();
  const receberMidia = await makeReceberMidia();
  const mensagens = notificacao.data.entry
    .flatMap((entrada) => entrada.changes)
    .filter((mudanca) => mudanca.field === "messages")
    .flatMap((mudanca) => mudanca.value.messages ?? []);

  for (const mensagem of mensagens) {
    const recebida = classificarMensagem(mensagem);
    const resultado =
      recebida.tipo === "midia"
        ? await receberMidia.execute({
            telefone: recebida.telefone,
            idDaMensagem: recebida.id,
            midia: recebida.midia,
            legenda: recebida.legenda,
          })
        : await receber.execute({
            telefone: recebida.telefone,
            texto: recebida.texto,
            id: recebida.id,
          });
    const falhaTransitoria = !resultado.ok && resultado.error instanceof ServicoExternoError;
    if (resultado.ok) continue;
    if (falhaTransitoria) {
      return resposta("Falha transitória; reenvie.", 502);
    }
    makeRegistroDeErros().registrar(`Mensagem ${mensagem.id} descartada:`, resultado.error.message);
  }
  return resposta("EVENT_RECEIVED", 200);
}
