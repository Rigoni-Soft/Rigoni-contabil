import { expect, test } from "@playwright/test";

// Cobre o cenário principal do ticket #29 (Registro de auditoria): a tela de
// feed bruto em /admin/auditoria é acessível só por Admin.
// Usuários: supabase/seed.sql (Admin de Teste e Funcionário Simples Nacional,
// ambiente Dev local; baseURL vem de playwright.config.ts).
//
// Locators presos ao alvo do seed ("funcionario.sn@..."/"CNPJ de teste"), não a
// textos genéricos como "usuario.criar": outros e2e (ex.: cadastro-usuario)
// também gravam auditoria de verdade e duplicariam um texto solto.

async function login(page: import("@playwright/test").Page, email: string, senha: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(senha);
  await page.getByRole("button", { name: "Entrar" }).click();
}

function linhaSucessoSeed(page: import("@playwright/test").Page) {
  return page.getByRole("row").filter({ hasText: "funcionario.sn@rigonicontabil.local" });
}

function linhaFalhaSeed(page: import("@playwright/test").Page) {
  return page.getByRole("row").filter({ hasText: "CNPJ de teste" });
}

test.describe("Feed de auditoria (Admin only)", () => {
  test("Admin vê o feed com o registro de exemplo do seed", async ({ page }) => {
    await login(page, "admin@rigonicontabil.local", "admin123");
    await expect(page).toHaveURL("/");

    await page.goto("/admin/auditoria");

    await expect(page).toHaveURL(/\/admin\/auditoria$/);
    await expect(linhaSucessoSeed(page)).toBeVisible();
    await expect(linhaSucessoSeed(page)).toContainText("usuario.criar");
  });

  test("Funcionário é redirecionado pra fora do feed de auditoria", async ({ page }) => {
    await login(page, "funcionario.sn@rigonicontabil.local", "func123");
    await expect(page).toHaveURL("/");

    await page.goto("/admin/auditoria");

    await expect(page).toHaveURL("/");
  });

  test("Admin filtra o feed por resultado e vê só o que combina", async ({ page }) => {
    await login(page, "admin@rigonicontabil.local", "admin123");
    await expect(page).toHaveURL("/");
    await page.goto("/admin/auditoria");
    await expect(linhaFalhaSeed(page)).toBeVisible();
    await expect(linhaSucessoSeed(page)).toBeVisible();

    await page.getByLabel("Resultado").selectOption("falha");
    await page.getByRole("button", { name: "Filtrar" }).click();

    await expect(linhaFalhaSeed(page)).toBeVisible();
    await expect(linhaSucessoSeed(page)).not.toBeVisible();

    await page.getByRole("button", { name: "Limpar" }).click();
    await expect(linhaSucessoSeed(page)).toBeVisible();
  });

  test("preencher só uma ponta do período mostra aviso e não filtra", async ({ page }) => {
    await login(page, "admin@rigonicontabil.local", "admin123");
    await expect(page).toHaveURL("/");
    await page.goto("/admin/auditoria");

    await page.getByLabel("De", { exact: true }).fill("2026-09-01");
    await page.getByRole("button", { name: "Filtrar" }).click();

    await expect(page.getByText("Informe as duas datas do período (De e Até).")).toBeVisible();
    await expect(linhaFalhaSeed(page)).toBeVisible();
    await expect(linhaSucessoSeed(page)).toBeVisible();
  });
});
