import { expect, test } from "./fixtures";

// Cobre o cenário principal do ticket #28 (RBAC básico, login, setores):
// login por e-mail/senha, shell autenticado mostrando papel/setor, navegação
// respeitando RBAC, logout. Usuários: supabase/seed.sql (ambiente Dev local).
const EMAIL = "admin@rigonicontabil.local";
const SENHA = "admin123";

async function login(page: import("@playwright/test").Page, email: string, senha: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(senha);
  await page.getByRole("button", { name: "Entrar" }).click();
}

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

  test("usuário já autenticado que visita /login é redirecionado pra /", async ({ page }) => {
    await login(page, EMAIL, SENHA);
    await expect(page).toHaveURL("/");

    await page.goto("/login");

    await expect(page).toHaveURL("/");
  });

  test("Admin: login, shell mostra papel/setor, nav lista todos os setores, logout @smoke", async ({
    page,
  }) => {
    await login(page, EMAIL, SENHA);

    await expect(page).toHaveURL("/");
    await expect(page.getByText("Admin de Teste")).toBeVisible();
    await expect(page.getByText(/acesso a todos os setores/i)).toBeVisible();

    const nav = page.getByRole("navigation", { name: "Setores" });
    await expect(nav.getByText("Simples Nacional")).toBeVisible();
    await expect(nav.getByText("Financeiro")).toBeVisible();
    await expect(nav.getByText("Contábil", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("Funcionário: shell mostra o próprio setor, nav mostra só o próprio setor", async ({
    page,
  }) => {
    await login(page, "funcionario.sn@rigonicontabil.local", "func123");

    // Simples Nacional é a página principal do próprio setor (#36, feedback
    // de teste manual) — login cai direto lá, não em "/".
    await expect(page).toHaveURL("/simples-nacional");
    await expect(page.getByText(/Setor: simples_nacional/)).toBeVisible();

    const nav = page.getByRole("navigation", { name: "Setores" });
    await expect(nav.getByText("Simples Nacional")).toBeVisible();
    await expect(nav.getByText("Financeiro")).not.toBeVisible();
    await expect(nav.getByText("Contábil")).not.toBeVisible();
  });

  test("Líder de setor: shell mostra o próprio setor, nav mostra só o próprio setor", async ({
    page,
  }) => {
    await login(page, "lider.contabil@rigonicontabil.local", "lider123");

    await expect(page).toHaveURL("/");
    await expect(page.getByText(/Setor: contabil/)).toBeVisible();

    const nav = page.getByRole("navigation", { name: "Setores" });
    await expect(nav.getByText("Contábil")).toBeVisible();
    await expect(nav.getByText("Simples Nacional")).not.toBeVisible();
    await expect(nav.getByText("Financeiro")).not.toBeVisible();
  });
});
