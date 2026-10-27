import { expect, test, type Page } from "@playwright/test";

import { login } from "./support/criar-cliente";

// Usa conta nova pra não mexer na senha das contas do seed.

async function criarFuncionarioComSenhaDefinitiva(page: Page) {
  await login(page, "admin@rigonicontabil.local", "admin123");
  await expect(page).toHaveURL("/");
  await page.goto("/admin/usuarios/novo");

  const email = `e2e-perfil-${Date.now()}@rigonicontabil.local`;
  await page.getByLabel("Nome").fill("Funcionário Perfil E2E");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Papel").selectOption("funcionario");
  await page.getByLabel("Setor").selectOption("financeiro");
  await page.getByRole("button", { name: "Cadastrar" }).click();
  const provisoria = await page.locator("p.font-mono").innerText();

  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await login(page, email, provisoria);
  await expect(page).toHaveURL("/trocar-senha");
  await page.getByLabel("Nova senha", { exact: true }).fill("senha-inicial-123");
  await page.getByLabel("Confirmar nova senha").fill("senha-inicial-123");
  await page.getByRole("button", { name: "Trocar senha" }).click();
  await expect(page).toHaveURL("/");

  return email;
}

test.describe("Perfil do usuário", () => {
  test("Funcionário abre o perfil pelo header, vê a própria conta e troca a senha por escolha @smoke", async ({
    page,
  }) => {
    const email = await criarFuncionarioComSenhaDefinitiva(page);

    // Sem senha provisória, /trocar-senha (fluxo obrigatório) leva ao perfil.
    await page.goto("/trocar-senha");
    await expect(page).toHaveURL("/perfil");

    await page.goto("/");
    await page.getByRole("link", { name: "Meu perfil" }).click();
    await expect(page).toHaveURL("/perfil");

    await expect(page.getByRole("heading", { name: "Meu perfil" })).toBeVisible();
    await expect(page.locator("dd", { hasText: "Funcionário Perfil E2E" })).toBeVisible();
    await expect(page.getByText(email, { exact: true })).toBeVisible();
    await expect(page.getByText("Financeiro", { exact: true })).toBeVisible();

    await page.getByLabel("Nova senha", { exact: true }).fill("senha-nova-456");
    await page.getByLabel("Confirmar nova senha").fill("senha-nova-456");
    await page.getByRole("button", { name: "Trocar senha" }).click();
    await expect(page).toHaveURL("/");

    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await login(page, email, "senha-nova-456");
    await expect(page).toHaveURL("/");
  });

  for (const { nome, papelLabel, email, senha, setorLabel } of [
    {
      nome: "Admin de Teste",
      papelLabel: "Admin",
      email: "admin@rigonicontabil.local",
      senha: "admin123",
      setorLabel: "Todos os setores",
    },
    {
      nome: "Líder Contábil",
      papelLabel: "Líder de setor",
      email: "lider.contabil@rigonicontabil.local",
      senha: "lider123",
      setorLabel: "Contábil",
    },
  ]) {
    test(`${papelLabel} abre o perfil e vê a própria conta`, async ({ page }) => {
      await login(page, email, senha);
      await expect(page).toHaveURL("/");

      await page.getByRole("link", { name: "Meu perfil" }).click();
      await expect(page).toHaveURL("/perfil");

      // Texto exato: "Admin" é substring do e-mail e "Contábil" do nome do Líder.
      for (const valor of [nome, email, papelLabel, setorLabel]) {
        await expect(page.locator("dd").getByText(valor, { exact: true })).toBeVisible();
      }
    });
  }
});
