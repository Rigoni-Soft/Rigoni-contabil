import { createClient } from "@supabase/supabase-js";

import { expect, test } from "./fixtures";
import { login } from "./support/criar-cliente";

// Tela da Fila do Setor (#70). Os Atendimentos nascem direto no banco, já na Fila (sem
// Funcionário), com a espera começando no passado. Usuários: supabase/seed.sql, ambiente Dev local.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const CLIENTE = crypto.randomUUID();
const CNPJ = `7${Date.now()}`.slice(0, 14);
const TELEFONES = ["61955573001", "61955573002"];

test.describe("Fila do Setor (#70)", () => {
  test.beforeAll(async () => {
    await admin.from("atendimentos").delete().in("chave_telefone", TELEFONES);
    // A Fila é do Setor inteiro: Atendimentos soltos de outras execuções mudariam as posições.
    await admin.from("atendimentos").delete().eq("setor", "financeiro").is("funcionario_id", null);
    const cliente = await admin
      .from("clientes")
      .insert({ id: CLIENTE, empresa: "Fila E2E Ltda", cnpj: CNPJ, regime: "lucro_presumido" });
    if (cliente.error) throw cliente.error;
    const contato = await admin.from("cliente_contatos").insert({
      id: crypto.randomUUID(),
      cliente_id: CLIENTE,
      nome: "Seu Fila",
      telefone: "(61) 95557-3001",
      padrao: true,
    });
    if (contato.error) throw contato.error;

    const agora = Date.now();
    const atendimentos = await admin.from("atendimentos").insert([
      {
        telefone: `55${TELEFONES[0]}`,
        chave_telefone: TELEFONES[0],
        cliente_id: CLIENTE,
        setor: "financeiro",
        fila_desde: new Date(agora - 5 * 60_000).toISOString(),
      },
      {
        telefone: `55${TELEFONES[1]}`,
        chave_telefone: TELEFONES[1],
        setor: "financeiro",
        fila_desde: new Date(agora - 60_000).toISOString(),
      },
    ]);
    if (atendimentos.error) throw atendimentos.error;
  });

  test.afterAll(async () => {
    await admin.from("atendimentos").delete().in("chave_telefone", TELEFONES);
    await admin.from("clientes").delete().eq("id", CLIENTE);
  });

  test("o Funcionário vê a Fila do próprio Setor, do mais antigo ao mais novo, com cronômetro correndo @smoke", async ({
    page,
  }) => {
    await login(page, "funcionario.financeiro@rigonicontabil.local", "func123");
    await expect(page).toHaveURL("/");

    await page.getByRole("link", { name: "Fila" }).click();
    await expect(page).toHaveURL("/fila");

    const itens = page.getByRole("region", { name: "Fila do Setor" }).getByRole("listitem");
    await expect(itens).toHaveCount(2);
    await expect(itens.nth(0)).toContainText("Seu Fila");
    await expect(itens.nth(0)).toContainText("Fila E2E Ltda");
    await expect(itens.nth(0)).toContainText("(61) 95557-3001");
    await expect(itens.nth(1)).toContainText("Contato não identificado");

    // O tempo corre sem recarregar a página.
    const espera = itens.nth(0).getByText(/^\d{2}:\d{2}$/);
    const antes = await espera.textContent();
    await expect(espera).not.toHaveText(antes ?? "");

    // Funcionário não escolhe Setor: só vê a própria Fila.
    await expect(page.getByRole("combobox", { name: "Setor" })).toHaveCount(0);
  });

  test("o Admin escolhe o Setor da Fila", async ({ page }) => {
    await login(page, "admin@rigonicontabil.local", "admin123");
    await expect(page).toHaveURL("/");

    await page.goto("/fila");
    await page.getByRole("combobox", { name: "Setor" }).selectOption("financeiro");

    await expect(page.getByRole("listitem").filter({ hasText: "Seu Fila" })).toBeVisible();
  });
});
