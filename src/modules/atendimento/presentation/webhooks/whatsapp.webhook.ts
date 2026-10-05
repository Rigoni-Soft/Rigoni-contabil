import { z } from "zod";

import { makeAutenticacaoWebhook, makeReceberMensagem } from "@/main/atendimento.factory";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";

// Payload de notificação da WhatsApp Cloud API (Meta). Só o que o sistema lê; o
// resto (metadata, contacts, pricing...) é ignorado. Mensagens e statuses podem
// vir em lote (até 1000 por chamada).
const notificacaoSchema = z.object({
  object: z.literal("whatsapp_business_account"),
  entry: z.array(
    z.object({
      changes: z.array(
        z.object({
          field: z.string(),
          value: z.object({
            messages: z
              .array(
                z.object({
                  from: z.string().min(1),
                  id: z.string(),
                  text: z.object({ body: z.string() }).optional(),
                }),
              )
              .optional(),
          }),
        }),
      ),
    }),
  ),
});

const resposta = (corpo: string, status: number) => new Response(corpo, { status });

// Handshake de verificação: devolve `hub.challenge` se o token confere.
export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const modo = params.get("hub.mode");
  const challenge = params.get("hub.challenge");
  const token = params.get("hub.verify_token");
  if (!modo || !challenge || !token) return resposta("Parâmetros hub.* ausentes.", 400);
  if (modo !== "subscribe" || !makeAutenticacaoWebhook().tokenValido(token)) {
    return resposta("Verificação recusada.", 403);
  }
  return resposta(challenge, 200);
}

// Contrato com a Meta: qualquer status != 200 faz ela reenviar por até 7 dias
// (docs/contratos/mensageria.md). Por isso falha permanente do nosso lado (ex.:
// número sem WhatsApp, erro 400 da Cloud API) é registrada e confirmada com 200;
// só falha transitória devolve 502 pra provocar o reenvio.
export async function POST(request: Request): Promise<Response> {
  const corpoCru = await request.text();
  const assinatura = request.headers.get("x-hub-signature-256");
  if (!makeAutenticacaoWebhook().assinaturaValida(corpoCru, assinatura)) {
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

  const receber = makeReceberMensagem();
  const mensagens = notificacao.data.entry
    .flatMap((entrada) => entrada.changes)
    .filter((mudanca) => mudanca.field === "messages")
    .flatMap((mudanca) => mudanca.value.messages ?? []);

  for (const mensagem of mensagens) {
    // Mídia/áudio/etc. não têm `text`: texto vazio reabre o menu.
    const resultado = await receber.execute({
      telefone: mensagem.from,
      texto: mensagem.text?.body ?? "",
    });
    if (resultado.ok) continue;
    if (resultado.error instanceof ServicoExternoError) {
      return resposta("Falha transitória; reenvie.", 502);
    }
    console.error(`Mensagem ${mensagem.id} descartada:`, resultado.error.message);
  }
  // `statuses` (sent/delivered/read/failed) e tipos não suportados caem aqui: 200 sem efeito.
  return resposta("EVENT_RECEIVED", 200);
}
