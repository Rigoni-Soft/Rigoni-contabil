import { expect, test } from "./fixtures";

// Cobre o cenário principal do ticket #33 (Admin cadastra Cliente): Empresa,
// CNPJ, Regime, contrato social e alterações contratuais anexados no Storage,
// ação registrada na auditoria. Usuários: supabase/seed.sql, ambiente Dev local.

async function login(page: import("@playwright/test").Page, email: string, senha: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(senha);
  await page.getByRole("button", { name: "Entrar" }).click();
}

function pdf(nome: string) {
  return { name: nome, mimeType: "application/pdf", buffer: Buffer.from("conteúdo de teste") };
}

test.describe("Cadastro de Cliente (Admin only)", () => {
  test("Admin cadastra um Cliente com contrato social e uma alteração contratual", async ({
    page,
  }) => {
    await login(page, "admin@rigonicontabil.local", "admin123");
    await expect(page).toHaveURL("/");
    await page.goto("/admin/clientes/novo");

    const cnpj = "11.444.777/0001-61";
    await page.getByLabel("Empresa").fill("Padaria Pão Quente E2E Ltda");
    await page.getByLabel("CNPJ").fill(cnpj);
    await page.getByLabel("Regime").selectOption("simples_nacional");
    await page.getByLabel("Contrato social").setInputFiles(pdf("contrato-social.pdf"));

    await page.getByRole("button", { name: "Adicionar" }).click();
    await page.getByLabel("Data da alteração 1").fill("2026-02-01");
    await page.getByLabel("Arquivo da alteração 1").setInputFiles(pdf("alteracao-1.pdf"));

    await page.getByRole("button", { name: "Cadastrar" }).click();

    await expect(page.getByText("Padaria Pão Quente E2E Ltda")).toBeVisible();
    await expect(page.getByText("11444777000161")).toBeVisible();
  });

  test("'Cadastrar outro' volta pro formulário limpo; 'Finalizar' leva pra home", async ({
    page,
  }) => {
    await login(page, "admin@rigonicontabil.local", "admin123");
    await expect(page).toHaveURL("/");
    await page.goto("/admin/clientes/novo");

    await page.getByLabel("Empresa").fill("Cliente E2E 2");
    await page.getByLabel("CNPJ").fill("11.222.333/0001-81");
    await page.getByLabel("Regime").selectOption("simples_nacional");
    await page.getByLabel("Contrato social").setInputFiles(pdf("contrato-social.pdf"));
    await page.getByRole("button", { name: "Cadastrar" }).click();
    await expect(page.getByText("Cliente E2E 2")).toBeVisible();

    await page.getByRole("button", { name: "Cadastrar outro" }).click();
    await expect(page.getByLabel("Empresa")).toHaveValue("");
    await expect(page.getByText("Cliente E2E 2")).not.toBeVisible();

    await page.getByLabel("Empresa").fill("Cliente E2E 3");
    await page.getByLabel("CNPJ").fill("12.345.678/0001-95");
    await page.getByLabel("Regime").selectOption("simples_nacional");
    await page.getByLabel("Contrato social").setInputFiles(pdf("contrato-social.pdf"));
    await page.getByRole("button", { name: "Cadastrar" }).click();
    await expect(page.getByText("Cliente E2E 3")).toBeVisible();

    await page.getByRole("link", { name: "Finalizar" }).click();
    await expect(page).toHaveURL("/");
  });

  test("Funcionário é redirecionado pra fora do cadastro de Cliente", async ({ page }) => {
    await login(page, "funcionario.sn@rigonicontabil.local", "func123");
    await expect(page).toHaveURL("/");

    await page.goto("/admin/clientes/novo");

    await expect(page).toHaveURL("/");
  });

  test("Líder de setor também é redirecionado (só Admin cadastra Cliente, #33)", async ({
    page,
  }) => {
    await login(page, "lider.contabil@rigonicontabil.local", "lider123");
    await expect(page).toHaveURL("/");

    await page.goto("/admin/clientes/novo");

    await expect(page).toHaveURL("/");
  });
});
