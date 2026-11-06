import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import { login } from "./support/criar-cliente";

async function cadastrarFuncionario(page: Page): Promise<{ email: string; senha: string }> {
  await login(page, "admin@rigonicontabil.local", "admin123");
  await expect(page).toHaveURL("/");
  await page.goto("/admin/usuarios/novo");

  const email = `e2e-troca-senha-${Date.now()}@rigonicontabil.local`;
  await page.getByLabel("Nome").fill("Funcionário Troca Senha E2E");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Papel").selectOption("funcionario");
  await page.getByLabel("Setor").selectOption("financeiro");
  await page.getByRole("button", { name: "Cadastrar" }).click();

  const senha = await page.locator("p.font-mono").innerText();

  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/login$/);

  return { email, senha };
}

test.describe("Troca obrigatória de senha no primeiro login", () => {
  test("conta nova é redirecionada pra /trocar-senha e fica bloqueada até trocar @smoke", async ({
    page,
  }) => {
    const { email, senha } = await cadastrarFuncionario(page);

    await login(page, email, senha);
    await expect(page).toHaveURL("/trocar-senha");

    // Bloqueado em qualquer tela até trocar.
    await page.goto("/");
    await expect(page).toHaveURL("/trocar-senha");

    // Logout disponível na tela de troca obrigatória.
    await expect(page.getByRole("button", { name: "Sair" })).toBeVisible();
  });

  test("após trocar a senha, acessa o sistema normalmente e a nova senha passa a valer", async ({
    page,
  }) => {
    const { email, senha } = await cadastrarFuncionario(page);
    await login(page, email, senha);
    await expect(page).toHaveURL("/trocar-senha");

    await page.getByLabel("Nova senha", { exact: true }).fill("senha-definitiva-123");
    await page.getByLabel("Confirmar nova senha").fill("senha-definitiva-123");
    await page.getByRole("button", { name: "Trocar senha" }).click();

    await expect(page).toHaveURL("/");

    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/login$/);

    await login(page, email, "senha-definitiva-123");
    await expect(page).toHaveURL("/");
  });
});
