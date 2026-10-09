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
const FUNCIONARIO = "33333333-3333-3333-3333-333333333333"; // funcionario.financeiro
const TELEFONES = ["61955573001", "61955573002", "61955573003", "61955573004"];

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
      // Atendimento em andamento do Funcionário: é a conversa onde a Fila aparece na lateral.
      {
        telefone: `55${TELEFONES[3]}`,
        chave_telefone: TELEFONES[3],
        setor: "financeiro",
        funcionario_id: FUNCIONARIO,
        assumido_em: new Date(agora).toISOString(),
      },
      // Fila de outro Setor: o Funcionário do financeiro não a enxerga.
      {
        telefone: `55${TELEFONES[2]}`,
        chave_telefone: TELEFONES[2],
        setor: "rh",
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

    // Sem botão no cabeçalho: a Fila está na conversa e o cartão do dock leva à tela dela.
    await expect(page.getByRole("link", { name: "Fila", exact: true })).toHaveCount(0);
    await page
      .getByRole("navigation", { name: "Atendimentos em andamento" })
      .getByRole("link", { name: /Fila de atendimento/ })
      .click();
    await expect(page).toHaveURL("/fila");

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /^Fila de atendimento do .+, setor Financeiro$/,
      }),
    ).toBeVisible();

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
    // Nem a Fila de outro Setor (RH): só os 2 do financeiro, e o telefone do RH não aparece.
    await expect(page.getByRole("combobox", { name: "Setor" })).toHaveCount(0);
    await expect(itens).toHaveCount(2);
    await expect(page.getByText("(61) 95557-3003")).toHaveCount(0);
  });

  test("na conversa a Fila fica na barra lateral esquerda, com o título do Funcionário e do Setor @smoke", async ({
    page,
  }) => {
    await login(page, "funcionario.financeiro@rigonicontabil.local", "func123");
    await expect(page).toHaveURL("/");

    // Fora da conversa e da Fila, o dock avisa que há gente esperando.
    const dock = page.getByRole("navigation", { name: "Atendimentos em andamento" });
    await expect(dock.getByRole("link", { name: /Fila de atendimento/ })).toBeVisible();

    await dock.getByRole("link", { name: /95557-3004/ }).click();
    const lateral = page.getByRole("complementary", { name: "Fila de atendimento" });
    await expect(
      lateral.getByRole("heading", {
        level: 2,
        name: /^Fila de atendimento do .+, setor Financeiro$/,
      }),
    ).toBeVisible();
    await expect(lateral.getByText("Seu Fila")).toBeVisible();
    // Na conversa a Fila já está à vista: o cartão do dock some.
    await expect(dock.getByRole("link", { name: /Fila de atendimento/ })).toHaveCount(0);
  });

  test("o Admin escolhe o Setor da Fila", async ({ page }) => {
    await login(page, "admin@rigonicontabil.local", "admin123");
    await expect(page).toHaveURL("/");

    await page.getByRole("link", { name: "Fila", exact: true }).click();
    await expect(page).toHaveURL("/fila");
    await page.getByRole("combobox", { name: "Setor" }).selectOption("financeiro");

    await expect(page.getByRole("listitem").filter({ hasText: "Seu Fila" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: /setor Financeiro$/ })).toBeVisible();
  });
});
