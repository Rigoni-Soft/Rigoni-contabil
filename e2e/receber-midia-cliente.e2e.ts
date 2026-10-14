import { createHmac } from "node:crypto";

import type { APIRequestContext } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import { expect, test } from "./fixtures";
import { login } from "./support/criar-cliente";

// Mídia do cliente (#81): o cliente manda um áudio pelo WhatsApp (webhook, adapter falso de download)
// e o Funcionário o vê e o toca na conversa. O Atendimento nasce direto no banco; o webhook é
// chamado com a assinatura HMAC do segredo de desenvolvimento. Usuário: supabase/seed.sql
// (funcionario2.sn).
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const SEGREDO = process.env.MENSAGERIA_SEGREDO_ASSINATURA ?? "segredo-falso";
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const FUNCIONARIO = "99999999-9999-9999-9999-999999999999";
const TELEFONE = "61955572081";
const CLIENTE = crypto.randomUUID();
const CNPJ = `7${Date.now()}`.slice(0, 14);

function notificacao(mensagem: object): string {
  return JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "1",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "15550783881", phone_number_id: "1" },
              messages: [{ from: `55${TELEFONE}`, timestamp: "1749416383", ...mensagem }],
            },
          },
        ],
      },
    ],
  });
}

test.describe("Mídia recebida do cliente (#81)", () => {
  test.beforeAll(async () => {
    await admin.from("atendimentos").delete().eq("funcionario_id", FUNCIONARIO);
    const cliente = await admin
      .from("clientes")
      .insert({ id: CLIENTE, empresa: "Midia E2E Ltda", cnpj: CNPJ, regime: "simples_nacional" });
    if (cliente.error) throw cliente.error;
    const contato = await admin.from("cliente_contatos").insert({
      id: crypto.randomUUID(),
      cliente_id: CLIENTE,
      nome: "Seu Midia",
      telefone: "(61) 95557-2081",
      padrao: true,
    });
    if (contato.error) throw contato.error;
    const atendimento = await admin
      .from("atendimentos")
      .insert({
        telefone: `55${TELEFONE}`,
        chave_telefone: TELEFONE,
        cliente_id: CLIENTE,
        setor: "simples_nacional",
        funcionario_id: FUNCIONARIO,
        assumido_em: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (atendimento.error) throw atendimento.error;
    const mensagem = await admin.from("mensagens").insert({
      atendimento_id: atendimento.data.id,
      autor: "contato",
      texto: "Vou mandar um áudio",
      id_externo: "wamid.E2E-MIDIA-0",
    });
    if (mensagem.error) throw mensagem.error;
  });

  test.afterAll(async () => {
    const anexos = await admin
      .from("mensagens")
      .select("anexo_caminho, atendimentos!inner(cliente_id)")
      .eq("atendimentos.cliente_id", CLIENTE)
      .not("anexo_caminho", "is", null);
    const caminhos = (anexos.data ?? []).map((m) => m.anexo_caminho as string);
    if (caminhos.length) await admin.storage.from("anexos-atendimento").remove(caminhos);
    await admin.from("atendimentos").delete().eq("cliente_id", CLIENTE);
    await admin.from("clientes").delete().eq("id", CLIENTE);
  });

  async function receber(request: APIRequestContext, mensagem: object) {
    const corpo = notificacao(mensagem);
    const assinatura = `sha256=${createHmac("sha256", SEGREDO).update(corpo).digest("hex")}`;
    const resposta = await request.post("/api/webhooks/whatsapp", {
      data: corpo,
      headers: { "content-type": "application/json", "x-hub-signature-256": assinatura },
    });
    expect(resposta.status()).toBe(200);
  }

  test("PDF e imagem do cliente podem ser visualizados e baixados @smoke", async ({
    page,
    request,
    context,
  }) => {
    await receber(request, {
      id: "wamid.E2E-MIDIA-2",
      type: "document",
      document: {
        id: "midia-teste-documento",
        mime_type: "application/pdf",
        filename: "documento-de-teste.pdf",
        caption: "segue o balanço",
      },
    });
    await receber(request, {
      id: "wamid.E2E-MIDIA-3",
      type: "image",
      image: { id: "midia-teste-imagem", mime_type: "image/png" },
    });

    await login(page, "funcionario2.sn@rigonicontabil.local", "func123");
    await expect(page).toHaveURL(/\/(simples-nacional)?$/);
    await page
      .getByRole("navigation", { name: "Atendimentos em andamento" })
      .getByRole("link", { name: /Seu Midia/ })
      .click();
    await expect(page.getByText("segue o balanço")).toBeVisible();

    // PDF: "Visualizar" abre numa aba nova, já no navegador (sem forçar download).
    const visualizar = page.getByRole("link", { name: "Visualizar documento-de-teste.pdf" });
    const href = await visualizar.getAttribute("href");
    const resposta = await request.get(href!);
    expect(resposta.headers()["content-type"]).toContain("application/pdf");
    expect(resposta.headers()["content-disposition"]).toBeUndefined();
    const [aba] = await Promise.all([context.waitForEvent("page"), visualizar.click()]);
    // O Chromium sem interface não renderiza o visualizador de PDF: basta a aba ter sido aberta.
    await aba.close();

    // "Baixar" entrega o arquivo com o nome original (pasta Downloads).
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("link", { name: "Baixar documento-de-teste.pdf" }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("documento-de-teste.pdf");

    // Imagem: amplia e também baixa.
    await page.getByRole("button", { name: /^Ampliar / }).click();
    const [downloadImagem] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("link", { name: /^Baixar (imagem\.png)$/ }).click(),
    ]);
    expect(downloadImagem.suggestedFilename()).toBe("imagem.png");
  });

  test("o áudio que o cliente envia aparece na conversa com player e o balão do cliente @smoke", async ({
    page,
    request,
  }) => {
    const corpo = notificacao({
      id: "wamid.E2E-MIDIA-1",
      type: "audio",
      audio: { id: "midia-teste-audio", mime_type: "audio/ogg; codecs=opus", voice: true },
    });
    const assinatura = `sha256=${createHmac("sha256", SEGREDO).update(corpo).digest("hex")}`;
    const resposta = await request.post("/api/webhooks/whatsapp", {
      data: corpo,
      headers: { "content-type": "application/json", "x-hub-signature-256": assinatura },
    });
    expect(resposta.status()).toBe(200);

    await login(page, "funcionario2.sn@rigonicontabil.local", "func123");
    // O Funcionário do Simples Nacional cai no painel do setor, os demais em "/".
    await expect(page).toHaveURL(/\/(simples-nacional)?$/);
    await page
      .getByRole("navigation", { name: "Atendimentos em andamento" })
      .getByRole("link", { name: /Seu Midia/ })
      .click();
    await expect(page).toHaveURL(/\/atendimento\/[0-9a-f-]{36}$/);

    const balao = page
      .getByRole("listitem")
      .filter({ has: page.getByLabel(/^Áudio: audio\.ogg$/) });
    await expect(balao).toBeVisible();
    await expect(balao).toContainText("Seu Midia");
    await expect(balao).toContainText("CNPJ");
    await expect(page.getByLabel("Áudio: audio.ogg")).toBeVisible();
  });
});
