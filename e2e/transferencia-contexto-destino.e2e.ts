import { createClient } from "@supabase/supabase-js";

import { expect, test } from "./fixtures";
import { login } from "./support/criar-cliente";

// Contexto da Transferência (#74): o Funcionário transfere pelo painel e o destino lê, na conversa,
// o contato, a empresa, o CNPJ, quem transferiu e o resumo. O Líder do Contábil lê mesmo que o
// Balanceamento tenha mandado o Atendimento para a Fila. Usuários: supabase/seed.sql.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const FUNCIONARIO = "55555555-5555-5555-5555-555555555555";
const TELEFONE = "61955574001";
const CLIENTE = crypto.randomUUID();
const CNPJ = `7${Date.now()}`.slice(0, 14);
const RESUMO = "Cliente quer revisar o DAS de setembro";

test.describe("Contexto da Transferência (#74)", () => {
  test.beforeAll(async () => {
    await admin.from("atendimentos").delete().eq("funcionario_id", FUNCIONARIO);
    const cliente = await admin
      .from("clientes")
      .insert({ id: CLIENTE, empresa: "Contexto E2E Ltda", cnpj: CNPJ, regime: "lucro_presumido" });
    if (cliente.error) throw cliente.error;
    const contato = await admin.from("cliente_contatos").insert({
      id: crypto.randomUUID(),
      cliente_id: CLIENTE,
      nome: "Seu Contexto",
      telefone: "(61) 95557-4001",
      padrao: true,
    });
    if (contato.error) throw contato.error;
    const atendimento = await admin.from("atendimentos").insert({
      telefone: `55${TELEFONE}`,
      chave_telefone: TELEFONE,
      cliente_id: CLIENTE,
      setor: "financeiro",
      funcionario_id: FUNCIONARIO,
      assumido_em: new Date().toISOString(),
    });
    if (atendimento.error) throw atendimento.error;
  });

  test.afterAll(async () => {
    await admin.from("atendimentos").delete().eq("cliente_id", CLIENTE);
    await admin.from("clientes").delete().eq("id", CLIENTE);
  });

  test("o destino lê o contato, a empresa, o CNPJ, quem transferiu e o resumo @smoke", async ({
    page,
  }) => {
    await login(page, "funcionario2.financeiro@rigonicontabil.local", "func123");
    await expect(page).toHaveURL("/");
    await page
      .getByRole("navigation", { name: "Atendimentos em andamento" })
      .getByRole("link")
      .click();

    const painel = page.getByRole("complementary", { name: "Ações do Atendimento" });
    await painel.getByLabel("Setor de destino").selectOption({ label: "Contábil" });
    await painel.getByLabel("Resumo do assunto").fill(RESUMO);
    await painel.getByRole("button", { name: "Transferir" }).click();
    await expect(page).toHaveURL("/");

    const atendimento = await admin
      .from("atendimentos")
      .select("id")
      .eq("cliente_id", CLIENTE)
      .single();
    if (atendimento.error) throw atendimento.error;

    await page.context().clearCookies();
    await login(page, "lider.contabil@rigonicontabil.local", "lider123");
    await expect(page).toHaveURL("/");
    await page.goto(`/atendimento/${atendimento.data.id}`);

    await expect(page.getByRole("heading", { name: "Seu Contexto" })).toBeVisible();
    await expect(page.getByText("Contexto E2E Ltda ·")).toBeVisible();
    await expect(
      page.getByText("Transferido por Segundo Funcionário Financeiro · Financeiro"),
    ).toBeVisible();
    await expect(page.getByText(RESUMO)).toBeVisible();
  });

  test("o Atendimento aberto pela URA mostra o resumo e, sem Cliente, o CNPJ informado @smoke", async ({
    page,
  }) => {
    const telefone = "61955574002";
    const aberto = await admin
      .from("atendimentos")
      .insert({
        telefone: `55${telefone}`,
        chave_telefone: telefone,
        setor: "recepcao",
        resumo_ura: "Quer abrir uma empresa nova",
        cnpj_informado: "11444777000161",
      })
      .select("id")
      .single();
    if (aberto.error) throw aberto.error;

    try {
      await login(page, "admin@rigonicontabil.local", "admin123");
      await expect(page).toHaveURL("/");
      await page.goto(`/atendimento/${aberto.data.id}`);

      await expect(page.getByText("Aberto pela URA")).toBeVisible();
      await expect(page.getByText("Quer abrir uma empresa nova")).toBeVisible();
      await expect(
        page.getByText("Provável cliente novo · CNPJ informado 11.444.777/0001-61"),
      ).toBeVisible();
    } finally {
      await admin.from("atendimentos").delete().eq("id", aberto.data.id);
    }
  });
});
