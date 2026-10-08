import { createClient } from "@supabase/supabase-js";

import { expect, test } from "./fixtures";
import { login } from "./support/criar-cliente";

// Painel do Funcionário (#49): o Atendimento em andamento fica visível ao trocar de tela, a
// conversa mostra cada balão com quem escreveu, e o disparo de documento usa o Cliente já
// vinculado. O Atendimento nasce direto no banco (a URA/webhook é outro ticket). Usuário:
// supabase/seed.sql (funcionario2.financeiro), ambiente Dev local.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const FUNCIONARIO = "55555555-5555-5555-5555-555555555555";
const TELEFONE = "61955572001";
const CLIENTE = crypto.randomUUID();
const CNPJ = `6${Date.now()}`.slice(0, 14);

test.describe("Painel do Funcionário (#49)", () => {
  test.beforeAll(async () => {
    await admin.from("atendimentos").delete().eq("funcionario_id", FUNCIONARIO);
    const cliente = await admin
      .from("clientes")
      .insert({ id: CLIENTE, empresa: "Painel E2E Ltda", cnpj: CNPJ, regime: "lucro_presumido" });
    if (cliente.error) throw cliente.error;
    const contato = await admin.from("cliente_contatos").insert({
      id: crypto.randomUUID(),
      cliente_id: CLIENTE,
      nome: "Dona Painel",
      telefone: "(61) 95557-2001",
      padrao: true,
    });
    if (contato.error) throw contato.error;
    const atendimento = await admin
      .from("atendimentos")
      .insert({
        telefone: `55${TELEFONE}`,
        chave_telefone: TELEFONE,
        cliente_id: CLIENTE,
        setor: "financeiro",
        funcionario_id: FUNCIONARIO,
        assumido_em: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (atendimento.error) throw atendimento.error;
    const mensagens = await admin.from("mensagens").insert([
      {
        atendimento_id: atendimento.data.id,
        autor: "contato",
        texto: "Preciso do contrato social",
      },
      {
        atendimento_id: atendimento.data.id,
        autor: "funcionario",
        funcionario_id: FUNCIONARIO,
        texto: "Já te envio",
      },
    ]);
    if (mensagens.error) throw mensagens.error;
  });

  test.afterAll(async () => {
    // Por Cliente, não por Funcionário: depois de transferido o Atendimento muda de dono.
    await admin.from("atendimentos").delete().eq("cliente_id", CLIENTE);
    await admin.from("clientes").delete().eq("id", CLIENTE);
  });

  test("o Atendimento fica visível ao trocar de tela e a conversa mostra quem escreveu cada balão @smoke", async ({
    page,
  }) => {
    await login(page, "funcionario2.financeiro@rigonicontabil.local", "func123");
    await expect(page).toHaveURL("/");

    const atendimentos = page.getByRole("navigation", { name: "Atendimentos em andamento" });
    await expect(atendimentos.getByRole("link", { name: /Dona Painel/ })).toBeVisible();

    // Navegação do cliente (sem recarregar): o Atendimento não some ao trocar de tela.
    await page.getByRole("link", { name: "Meu perfil" }).click();
    await expect(page).toHaveURL("/perfil");
    await expect(atendimentos.getByRole("link", { name: /Dona Painel/ })).toBeVisible();

    await atendimentos.getByRole("link", { name: /Dona Painel/ }).click();
    await expect(page).toHaveURL(/\/atendimento\/[0-9a-f-]{36}$/);

    await expect(page.getByRole("heading", { name: "Dona Painel" })).toBeVisible();
    await expect(page.getByText("Painel E2E Ltda ·")).toBeVisible();
    const balaoDoCliente = page
      .getByRole("listitem")
      .filter({ hasText: "Preciso do contrato social" });
    await expect(balaoDoCliente).toContainText("Dona Painel");
    await expect(balaoDoCliente).toContainText("CNPJ");
    const balaoDoAtendente = page.getByRole("listitem").filter({ hasText: "Já te envio" });
    await expect(balaoDoAtendente).toContainText("Segundo Funcionário Financeiro · Financeiro");

    // Em tela larga a página não rola em nenhum sentido: só a lista de mensagens rola.
    const transborda = await page.evaluate(() => ({
      vertical: document.documentElement.scrollHeight > window.innerHeight,
      horizontal: document.documentElement.scrollWidth > window.innerWidth,
    }));
    expect(transborda).toEqual({ vertical: false, horizontal: false });

    // O Cliente está vinculado: o disparo oferece o documento sem pedir o CNPJ de novo.
    await expect(page.getByRole("heading", { name: "Serviços do cliente" })).toBeVisible();
  });

  test("o Funcionário responde ao cliente pelo campo da conversa e a resposta vira balão @smoke", async ({
    page,
  }) => {
    await login(page, "funcionario2.financeiro@rigonicontabil.local", "func123");
    await expect(page).toHaveURL("/");
    await page
      .getByRole("navigation", { name: "Atendimentos em andamento" })
      .getByRole("link")
      .click();

    const campo = page.getByLabel("Mensagem ao cliente");
    await campo.fill("Bom dia, Dona Painel! Já estou vendo.");
    await campo.press("Enter");

    const balao = page
      .getByRole("listitem")
      .filter({ hasText: "Bom dia, Dona Painel! Já estou vendo." });
    await expect(balao).toContainText("Segundo Funcionário Financeiro · Financeiro");
    await expect(campo).toHaveValue("");
  });

  test("mensagem nova do cliente, com o Funcionário em outra tela, aparece no dock com prévia e destaque", async ({
    page,
  }) => {
    await login(page, "funcionario2.financeiro@rigonicontabil.local", "func123");
    await expect(page).toHaveURL("/");
    await page.getByRole("link", { name: "Meu perfil" }).click();
    await expect(page).toHaveURL("/perfil");

    const atendimento = await admin
      .from("atendimentos")
      .select("id")
      .eq("cliente_id", CLIENTE)
      .single();
    if (atendimento.error) throw atendimento.error;
    const nova = await admin.from("mensagens").insert({
      atendimento_id: atendimento.data.id,
      autor: "contato",
      texto: "Chegou outra dúvida sobre o contrato",
    });
    if (nova.error) throw nova.error;

    // O dock consulta a cada 15 s: a prévia e o destaque aparecem sem sair da tela.
    const cartao = page
      .getByRole("navigation", { name: "Atendimentos em andamento" })
      .getByRole("link", { name: /Dona Painel/ });
    await expect(cartao).toContainText("Chegou outra dúvida sobre o contrato", { timeout: 30_000 });
    await expect(cartao).toContainText("nova mensagem");
  });

  test("o Funcionário transfere o Atendimento a outro Setor, que não oferece o Setor atual nem o Simples Nacional @smoke", async ({
    page,
  }) => {
    await login(page, "funcionario2.financeiro@rigonicontabil.local", "func123");
    await expect(page).toHaveURL("/");
    await page
      .getByRole("navigation", { name: "Atendimentos em andamento" })
      .getByRole("link")
      .click();

    const painel = page.getByRole("complementary", { name: "Ações do Atendimento" });
    const setores = painel.getByLabel("Setor de destino");
    await expect(setores.locator("option", { hasText: "Financeiro" })).toHaveCount(0);
    // O Cliente de teste é Lucro Presumido: o Simples Nacional não é destino possível.
    await expect(setores.locator("option", { hasText: "Simples Nacional" })).toHaveCount(0);

    await setores.selectOption({ label: "Tributário" });
    await painel.getByLabel("Resumo do assunto").fill("Cliente quer revisar o DAS");
    await painel.getByRole("button", { name: "Transferir" }).click();

    // Transferido, o Funcionário perde a conversa: a tela sai dela e o Atendimento some do dock.
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("navigation", { name: "Atendimentos em andamento" })).toHaveCount(
      0,
    );
  });
});
