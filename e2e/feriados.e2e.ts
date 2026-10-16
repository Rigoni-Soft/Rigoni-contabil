import { expect, test } from "./fixtures";

// Data distante para não colidir com outros cenários.
const DATA = "2031-03-17";

async function login(page: import("@playwright/test").Page, email: string, senha: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(senha);
  await page.getByRole("button", { name: "Entrar" }).click();
}

test.describe("Feriados (Admin only)", () => {
  test("Admin cadastra e remove um feriado @smoke", async ({ page }) => {
    await login(page, "admin@rigonicontabil.local", "admin123");
    await expect(page).toHaveURL("/");

    await page.goto("/admin/feriados");
    // Sobra de uma rodada que falhou no meio: limpa antes, senão o cadastro cai em "já existe".
    const sobra = page.getByRole("button", { name: "Remover feriado de 17/03/2031" });
    if (await sobra.count()) {
      await sobra.click();
      await expect(sobra).toHaveCount(0);
    }
    await page.getByLabel("Data").fill(DATA);
    await page.getByLabel("Descrição").fill("Aniversário da cidade (e2e)");
    await page.getByRole("button", { name: "Cadastrar feriado" }).click();

    const remover = page.getByRole("button", { name: "Remover feriado de 17/03/2031" });
    await expect(remover).toBeVisible();

    await remover.click();
    await expect(remover).toHaveCount(0);
  });

  test("Funcionário é redirecionado pra fora da tela de feriados", async ({ page }) => {
    await login(page, "funcionario.sn@rigonicontabil.local", "func123");
    await expect(page).toHaveURL("/simples-nacional");

    await page.goto("/admin/feriados");

    await expect(page).toHaveURL("/simples-nacional");
  });
});
