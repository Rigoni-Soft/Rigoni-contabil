import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, email: string, senha: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(senha);
  await page.getByRole("button", { name: "Entrar" }).click();
}

test("Admin desativa um Funcionário e ele não consegue mais logar", async ({ page }) => {
  await login(page, "admin@rigonicontabil.local", "admin123");
  await expect(page).toHaveURL("/");
  await page.goto("/admin/usuarios/novo");

  const email = `e2e-desativar-${Date.now()}@rigonicontabil.local`;
  const nome = `Funcionário Desativar ${Date.now()}`;
  await page.getByLabel("Nome").fill(nome);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Papel").selectOption("funcionario");
  await page.getByLabel("Setor").selectOption("financeiro");
  await page.getByRole("button", { name: "Cadastrar" }).click();
  const senha = await page.locator("p.font-mono").innerText();

  await page.goto("/admin/usuarios");
  await page.getByRole("button", { name: `Desativar ${nome}` }).click();
  await page.getByRole("button", { name: `Confirmar desativação de ${nome}` }).click();
  await expect(page.getByText(email)).toHaveCount(0);

  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await login(page, email, senha);
  await expect(page.getByText("Conta desativada.")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});
