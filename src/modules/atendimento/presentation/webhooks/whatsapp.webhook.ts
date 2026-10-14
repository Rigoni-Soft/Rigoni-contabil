import { z } from "zod";

import {
  makeAutenticarWebhook,
  makeReceberMensagem,
  makeReceberMidia,
} from "@/main/atendimento.factory";
import {
  classificarMensagem,
  mensagemSchema,
} from "@/modules/atendimento/presentation/webhooks/mensagem-recebida.webhook";
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
            messages: z.array(mensagemSchema).optional(),
          }),
        }),
      ),
    }),
  ),
});

type Notificacao = z.infer<typeof notificacaoSchema>;
type MensagemCloudApi = z.infer<typeof mensagemSchema>;

const resposta = (corpo: string, status: number) => new Response(corpo, { status });

function mensagensDe({ entry }: Notificacao): MensagemCloudApi[] {
  const mudancas = entry.flatMap((entrada) => entrada.changes);
  const deMensagens = mudancas.filter((mudanca) => mudanca.field === "messages");
  return deMensagens.flatMap((mudanca) => mudanca.value.messages ?? []);
}

// null = mensagem tratada (ou descartada); Response = falha transitória que deve parar o lote.
async function receberUma(mensagem: MensagemCloudApi): Promise<Response | null> {
  const recebida = classificarMensagem(mensagem);
  const resultado =
    recebida.tipo === "midia"
      ? await makeReceberMidia().execute({
          telefone: recebida.telefone,
          idDaMensagem: recebida.id,
          midia: recebida.midia,
          legenda: recebida.legenda,
        })
      : // Tipo sem tratamento (vídeo, figurinha...) chega como texto vazio e reabre o menu.
        await makeReceberMensagem().execute({
          telefone: recebida.telefone,
          texto: recebida.texto,
          id: recebida.id,
        });
  if (resultado.ok) return null;
  const erro = resultado.error;
  if (erro instanceof ServicoExternoError) return resposta("Falha transitória; reenvie.", 502);
  console.error(`Mensagem ${mensagem.id} descartada:`, erro.message);
  return null;
}

// Em ordem, parando na primeira falha transitória.
async function receberTodas(mensagens: MensagemCloudApi[]): Promise<Response | null> {
  for (const mensagem of mensagens) {
    const falha = await receberUma(mensagem);
    if (falha) return falha;
  }
  return null;
}

// Handshake de verificação: devolve `hub.challenge` se o token confere.
export async function GET(request: Request): Promise<Response> {
  const parametros = new URL(request.url).searchParams;
  const modo = parametros.get("hub.mode");
  const challenge = parametros.get("hub.challenge");
  const token = parametros.get("hub.verify_token");
  if (!modo || !challenge || !token) return resposta("Parâmetros hub.* ausentes.", 400);
  const tokenAceito = makeAutenticarWebhook().verificarToken(token);
  if (modo !== "subscribe" || !tokenAceito.ok) return resposta("Verificação recusada.", 403);
  return resposta(challenge, 200);
}

// Contrato com a Meta: qualquer status != 200 faz ela reenviar por até 7 dias
// (docs/contratos/mensageria.md). Por isso falha permanente do nosso lado (ex.:
// número sem WhatsApp, erro 400 da Cloud API) é registrada e confirmada com 200;
// só falha transitória devolve 502 pra provocar o reenvio.
export async function POST(request: Request): Promise<Response> {
  const corpoCru = await request.text();
  const assinatura = request.headers.get("x-hub-signature-256");
  const autenticado = makeAutenticarWebhook().verificarAssinatura(corpoCru, assinatura);
  if (!autenticado.ok) return resposta("Assinatura inválida.", 403);

  let json: unknown;
  try {
    json = JSON.parse(corpoCru);
  } catch {
    return resposta("Corpo não é JSON.", 400);
  }
  const notificacao = notificacaoSchema.safeParse(json);
  if (!notificacao.success) return resposta("Corpo fora do formato da Cloud API.", 400);

  const falha = await receberTodas(mensagensDe(notificacao.data));
  // `statuses` (sent/delivered/read/failed) e tipos não suportados caem aqui: 200 sem efeito.
  return falha ?? resposta("EVENT_RECEIVED", 200);
}
