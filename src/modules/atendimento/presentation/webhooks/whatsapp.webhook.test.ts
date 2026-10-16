/**
 * Integração handler de webhook ↔ caso de uso (testes.md, seção 3), com o
 * provedor simulado: a composição (`main`) é trocada por fakes em memória, mas
 * a autenticação usa o HMAC real.
 */
import { createHmac } from "node:crypto";

import type { AnexosAtendimentoPort } from "@/modules/atendimento/application/ports/out/anexos-atendimento.provider";
import type { AtendimentoRepositoryPort } from "@/modules/atendimento/application/ports/out/atendimento.repository";
import type { SessaoAtendimento } from "@/modules/atendimento/application/ports/out/sessao-atendimento.provider";
import { AutenticarWebhook } from "@/modules/atendimento/application/use-cases/autenticar-webhook.use-case";
import { ReceberMensagem } from "@/modules/atendimento/application/use-cases/receber-mensagem.use-case";
import { ReceberMidia } from "@/modules/atendimento/application/use-cases/receber-midia.use-case";
import { DownloadMidiaFalsoGateway } from "@/modules/atendimento/infra/gateways/download-midia-falso.gateway";
import { EnvioMensagemFalsoGateway } from "@/modules/atendimento/infra/gateways/envio-mensagem-falso.gateway";
import { HmacAutenticacaoWebhookGateway } from "@/modules/atendimento/infra/gateways/hmac-autenticacao-webhook.gateway";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { err, ok } from "@/shared/kernel/result";

import { GET, POST } from "./whatsapp.webhook";

const SEGREDO = "segredo-teste";
const TOKEN = "token-teste";
let envio: EnvioMensagemFalsoGateway;
let identificacao: ConstructorParameters<typeof ReceberMensagem>[0];
const documentos: ConstructorParameters<typeof ReceberMensagem>[2] = {
  listar: async () => ok([{ tipo: "contrato", data: null, caminho: "c1/contrato.pdf" }]),
  linkTemporario: async (caminho) => ok(`https://storage.test/${caminho}`),
};

const sessoesEmMemoria = new Map<string, SessaoAtendimento>();
const sessoes: ConstructorParameters<typeof ReceberMensagem>[3] = {
  obter: async (telefone) => ok(sessoesEmMemoria.get(telefone) ?? null),
  salvar: async (telefone, sessao) => {
    sessoesEmMemoria.set(telefone, sessao);
    return ok(undefined);
  },
  limpar: async (telefone) => {
    sessoesEmMemoria.delete(telefone);
    return ok(undefined);
  },
};

// Mídia: Atendimento em andamento do número e Mensagens registradas, em memória.
let atendimentoDaMidia: { atendimentoId: string } | null;
let registradas: { idExterno?: string; autor: string; texto: string; anexo?: { tipo: string } }[];
let guardados: string[];
const repositorioDeMidia = {
  atendimentoParaMidia: async (_: string, idExterno?: string) =>
    ok(
      atendimentoDaMidia && {
        ...atendimentoDaMidia,
        jaRegistrada: registradas.some((m) => m.idExterno === idExterno),
      },
    ),
  registrarMensagemRecebida: async (_: string, mensagem: (typeof registradas)[number]) => {
    registradas.push(mensagem);
    return ok("registrada" as const);
  },
} as unknown as AtendimentoRepositoryPort;
const anexosDeMidia = {
  guardar: async ({ arquivo }: { arquivo: { nome: string } }) => {
    guardados.push(arquivo.nome);
    return ok(`at-1/u/${arquivo.nome}`);
  },
  remover: async () => ok(undefined),
} as unknown as AnexosAtendimentoPort;

jest.mock("@/main/atendimento.factory", () => ({
  makeReceberMidia: () =>
    new ReceberMidia(repositorioDeMidia, new DownloadMidiaFalsoGateway(), anexosDeMidia, envio),
  makeReceberMensagem: () =>
    new ReceberMensagem(
      identificacao,
      envio,
      documentos,
      sessoes,
      {
        execute: async () => ok({ id: "at-1", funcionarioId: null }),
      },
      { execute: async () => ok({ anexada: false }) },
      // Quarta-feira, 10h em São Paulo: o expediente fica aberto independente da hora real.
      { agora: () => new Date("2026-10-07T10:00:00-03:00") },
      { listarDatas: async () => ok([]) },
      { buscar: async () => ok({ nomeArquivo: "DAS.pdf", pdfBase64: "JVBERi0=" }) },
    ),
  makeAutenticarWebhook: () =>
    new AutenticarWebhook(new HmacAutenticacaoWebhookGateway(SEGREDO, TOKEN)),
}));

const notificacao = (mensagens: object[], extra: object = {}) =>
  JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "102290129340398",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "15550783881", phone_number_id: "106540352242922" },
              contacts: [{ profile: { name: "Ana" }, wa_id: "5511912345678" }],
              messages: mensagens,
              ...extra,
            },
          },
        ],
      },
    ],
  });

const texto = (body: string, from = "5511912345678") => ({
  from,
  id: "wamid.HBgL",
  timestamp: "1749416383",
  type: "text",
  text: { body },
});

const assinar = (corpo: string) =>
  `sha256=${createHmac("sha256", SEGREDO).update(corpo).digest("hex")}`;

const enviar = (corpo: string, assinatura: string | null = assinar(corpo)) =>
  POST(
    new Request("http://localhost/api/webhooks/whatsapp", {
      method: "POST",
      body: corpo,
      headers: assinatura ? { "x-hub-signature-256": assinatura } : {},
    }),
  );

const verificar = (query: string) =>
  GET(new Request(`http://localhost/api/webhooks/whatsapp?${query}`));

beforeEach(() => {
  envio = new EnvioMensagemFalsoGateway();
  sessoesEmMemoria.clear();
  atendimentoDaMidia = { atendimentoId: "at-1" };
  registradas = [];
  guardados = [];
  identificacao = {
    identificar: async () => ok({ clienteId: "c1", nome: "Ana", empresa: "Padaria" }),
    cnpjCadastrado: async () => ok(true),
  };
  jest.spyOn(console, "info").mockImplementation(() => undefined);
  jest.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("GET /api/webhooks/whatsapp (handshake de verificação)", () => {
  it("200 com o hub.challenge quando o token confere", async () => {
    const r = await verificar(
      `hub.mode=subscribe&hub.verify_token=${TOKEN}&hub.challenge=1158201444`,
    );
    expect(r.status).toBe(200);
    expect(await r.text()).toBe("1158201444");
  });

  it.each([
    ["token errado", "hub.mode=subscribe&hub.verify_token=x&hub.challenge=1"],
    [
      "modo diferente de subscribe",
      `hub.mode=unsubscribe&hub.verify_token=${TOKEN}&hub.challenge=1`,
    ],
  ])("403 com %s", async (_, query) => {
    expect((await verificar(query)).status).toBe(403);
  });

  it("400 sem os parâmetros hub.*", async () => {
    expect((await verificar("")).status).toBe(400);
  });
});

describe("POST /api/webhooks/whatsapp (notificação)", () => {
  it("200 e responde com saudação + menu pro contato reconhecido", async () => {
    const r = await enviar(notificacao([texto("oi")]));
    expect(r.status).toBe(200);
    expect(envio.enviadas[0].telefone).toBe("5511912345678");
    expect(envio.enviadas[0].texto).toContain("Olá, Ana");
  });

  it("número desconhecido: CNPJ não encontrado ganha nova tentativa e, errando de novo, vai à recepção", async () => {
    identificacao = { identificar: async () => ok(null), cnpjCadastrado: async () => ok(false) };
    for (const t of ["oi", "sim", "11.222.333/0001-81", "11.222.333/0001-81"]) {
      expect((await enviar(notificacao([texto(t)]))).status).toBe(200);
    }
    const textos = envio.enviadas.map((e) => e.texto);
    expect(textos[2]).toContain("Confira e envie novamente");
    expect(textos[3]).toContain("recepção");
  });

  it("processa todas as mensagens de um lote", async () => {
    const r = await enviar(notificacao([texto("oi"), texto("2", "5511999990000")]));
    expect(r.status).toBe(200);
    expect(envio.enviadas).toHaveLength(1);
    expect(envio.documentosEnviados).toEqual([
      { telefone: "5511999990000", nomeArquivo: "DAS.pdf", pdfBase64: "JVBERi0=" },
    ]);
  });

  it("opção 5 do menu (falar com atendente) encaminha o contato reconhecido à recepção", async () => {
    const r = await enviar(notificacao([texto("5")]));
    expect(r.status).toBe(200);
    expect(envio.enviadas).toHaveLength(1);
    expect(envio.enviadas[0].texto).toContain("recepção");
  });

  it("opção 5 do menu (falar com atendente) encaminha o contato reconhecido à recepção", async () => {
    const r = await enviar(notificacao([texto("5")]));
    expect(r.status).toBe(200);
    expect(envio.enviadas).toHaveLength(1);
    expect(envio.enviadas[0].texto).toContain("recepção");
  });

  it("opção 1 do menu pergunta o tipo e, ao escolher contrato, entrega o documento", async () => {
    const r = await enviar(notificacao([texto("1"), texto("1")]));
    expect(r.status).toBe(200);
    expect(envio.enviadas[0].texto).toContain("Ambos");
    expect(envio.documentosEnviados).toEqual([
      {
        telefone: "5511912345678",
        url: "https://storage.test/c1/contrato.pdf",
        nomeArquivo: "Contrato social.pdf",
      },
    ]);
  });

  it("mensagem sem texto (ex.: áudio) reabre o menu", async () => {
    const r = await enviar(notificacao([{ from: "5511912345678", id: "w", type: "audio" }]));
    expect(r.status).toBe(200);
    expect(envio.enviadas[0].texto).toContain("Olá, Ana");
  });

  it("200 sem efeito pra notificação de status (delivered/read)", async () => {
    const corpo = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [
        {
          id: "1",
          changes: [
            {
              field: "messages",
              value: { statuses: [{ id: "wamid.x", status: "delivered", recipient_id: "55" }] },
            },
          ],
        },
      ],
    });
    expect((await enviar(corpo)).status).toBe(200);
    expect(envio.enviadas).toHaveLength(0);
  });

  it.each([
    ["ausente", null],
    ["inválida", "sha256=abc"],
  ])("403 com assinatura %s, sem efeito algum", async (_, assinatura) => {
    const r = await enviar(notificacao([texto("oi")]), assinatura);
    expect(r.status).toBe(403);
    expect(envio.enviadas).toHaveLength(0);
  });

  it.each([
    ["não é JSON", "isso nao e json"],
    ["não é da Cloud API", JSON.stringify({ object: "page", entry: [] })],
  ])("400 quando o corpo %s (assinado)", async (_, corpo) => {
    expect((await enviar(corpo)).status).toBe(400);
  });

  it("502 quando falha transitória (identificação) pra Meta reenviar", async () => {
    identificacao = {
      identificar: async () => err(new ServicoExternoError("banco")),
      cnpjCadastrado: async () => err(new ServicoExternoError("banco")),
    };
    expect((await enviar(notificacao([texto("oi")]))).status).toBe(502);
  });

  it("502 quando a Cloud API recusa por limite de taxa (130429)", async () => {
    envio = new EnvioMensagemFalsoGateway({ "5511912345678": 130429 });
    expect((await enviar(notificacao([texto("oi")]))).status).toBe(502);
  });

  it("200 quando a Cloud API recusa de forma permanente (133010, número sem WhatsApp): sem reenvio", async () => {
    envio = new EnvioMensagemFalsoGateway({ "5511912345678": 133010 });
    expect((await enviar(notificacao([texto("oi")]))).status).toBe(200);
  });
});

describe("POST /api/webhooks/whatsapp (mídia do cliente, #81)", () => {
  const audio = (id = "wamid.AUDIO") => ({
    from: "5511912345678",
    id,
    timestamp: "1749416383",
    type: "audio",
    audio: { id: "midia-teste-audio", mime_type: "audio/ogg; codecs=opus", voice: true },
  });

  it("áudio dentro de um Atendimento em andamento é guardado e registrado como Mensagem do contato", async () => {
    const r = await enviar(notificacao([audio()]));
    expect(r.status).toBe(200);
    expect(guardados).toEqual(["audio.ogg"]);
    expect(registradas).toMatchObject([
      { autor: "contato", idExterno: "wamid.AUDIO", anexo: { tipo: "audio" } },
    ]);
    expect(envio.enviadas).toHaveLength(0);
  });

  it("sem Atendimento em andamento: nada é baixado nem guardado, não reabre o menu e a URA pede texto", async () => {
    atendimentoDaMidia = null;
    const r = await enviar(notificacao([audio()]));
    expect(r.status).toBe(200);
    expect(guardados).toEqual([]);
    expect(registradas).toEqual([]);
    expect(envio.enviadas).toHaveLength(1);
    expect(envio.enviadas[0].texto).toContain("mensagens de texto");
    expect(envio.enviadas[0].texto).not.toContain("Olá, Ana");
  });

  it("reentrega do mesmo evento não duplica a Mensagem nem guarda o arquivo duas vezes", async () => {
    const corpo = notificacao([audio()]);
    expect((await enviar(corpo)).status).toBe(200);
    expect((await enviar(corpo)).status).toBe(200);
    expect(guardados).toHaveLength(1);
    expect(registradas).toHaveLength(1);
  });

  it("arquivo acima de 10 MB vira aviso do sistema na conversa e responde 200", async () => {
    const grande = {
      from: "5511912345678",
      id: "wamid.GRANDE",
      type: "document",
      document: { id: "midia-teste-grande", mime_type: "application/pdf", filename: "grande.pdf" },
    };
    expect((await enviar(notificacao([grande]))).status).toBe(200);
    expect(guardados).toEqual([]);
    expect(registradas).toMatchObject([{ autor: "ura", idExterno: "wamid.GRANDE" }]);
  });

  it("502 quando o provedor de mídia está fora do ar, para a Meta reenviar", async () => {
    const msg = { ...audio("wamid.FORA"), audio: { id: "midia-teste-fora-do-ar" } };
    expect((await enviar(notificacao([msg]))).status).toBe(502);
    expect(registradas).toEqual([]);
  });

  it("assinatura inválida não processa a mídia", async () => {
    expect((await enviar(notificacao([audio()]), "sha256=abc")).status).toBe(403);
    expect(guardados).toEqual([]);
  });
});
