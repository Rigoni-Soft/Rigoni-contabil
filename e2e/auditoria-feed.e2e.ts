import { expect, test } from "@playwright/test";

// Cobre o cenário principal do ticket #29 (Registro de auditoria): a tela de
// feed bruto em /admin/auditoria é acessível só por Admin.
// Usuários: supabase/seed.sql (Admin de Teste e Funcionário de Teste, ambiente Dev local).
test.use({ baseURL: `http://localhost:${process.env.PORT ?? 8800}` });

async function login(page: import("@playwright/test").Page, email: string, senha: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(senha);
  await page.getByRole("button", { name: "Entrar" }).click();
}

test.describe("Feed de auditoria (Admin only)", () => {
  test("Admin vê o feed com o registro de exemplo do seed", async ({ page }) => {
    await login(page, "admin@rigonicontabil.local", "admin123");
    await expect(page).toHaveURL("/");

    await page.goto("/admin/auditoria");

    await expect(page).toHaveURL(/\/admin\/auditoria$/);
    await expect(page.getByText("usuario.criar")).toBeVisible();
    await expect(page.getByText("funcionario@rigonicontabil.local")).toBeVisible();
  });

  test("Funcionário é redirecionado pra fora do feed de auditoria", async ({ page }) => {
    await login(page, "funcionario@rigonicontabil.local", "func123");
    await expect(page).toHaveURL("/");

    await page.goto("/admin/auditoria");

    await expect(page).toHaveURL("/");
  });

  test("Admin filtra o feed por resultado e vê só o que combina", async ({ page }) => {
    await login(page, "admin@rigonicontabil.local", "admin123");
    await expect(page).toHaveURL("/");
    await page.goto("/admin/auditoria");
    await expect(page.getByText("cliente.editar")).toBeVisible();
    await expect(page.getByText("usuario.criar")).toBeVisible();

    await page.getByLabel("Resultado").selectOption("falha");
    await page.getByRole("button", { name: "Filtrar" }).click();

    await expect(page.getByText("cliente.editar")).toBeVisible();
    await expect(page.getByText("usuario.criar")).not.toBeVisible();

    await page.getByRole("button", { name: "Limpar" }).click();
    await expect(page.getByText("usuario.criar")).toBeVisible();
  });
});
