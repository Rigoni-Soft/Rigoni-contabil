import { expect, test } from "@playwright/test";

// Cobre o cenário principal do ticket #28 (RBAC básico, login, setores):
// login por e-mail/senha, shell autenticado mostrando papel/setor, logout.
// Usuário: supabase/seed.sql (Admin de Teste, ambiente Dev local).
//
// playwright.config.ts não define baseURL/webServer (nenhum *.e2e.ts existia
// ainda), então este arquivo aponta para o `next dev` da seção 5 de
// testes.md (`yarn dev`, porta de PORT em .env.local) até que um ticket de
// infra de E2E centralize isso no config.
test.use({ baseURL: `http://localhost:${process.env.PORT ?? 8800}` });

const EMAIL = "admin@rigonicontabil.local";
const SENHA = "admin123";

test.describe("Login e shell autenticado", () => {
  test("visitante sem sessão é redirecionado para /login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("credenciais inválidas mostram erro e mantêm o visitante em /login", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel("E-mail").fill(EMAIL);
    await page.getByLabel("Senha").fill("senha-errada");
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("login válido leva ao shell e logout volta para /login", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel("E-mail").fill(EMAIL);
    await page.getByLabel("Senha").fill(SENHA);
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page).toHaveURL("/");
    await expect(page.getByText("Admin de Teste")).toBeVisible();
    await expect(page.getByText(/acesso a todos os setores/i)).toBeVisible();

    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});
