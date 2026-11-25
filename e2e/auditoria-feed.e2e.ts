import { expect, test } from "./fixtures";
import { adminLocal } from "./support/admin-local";
import { login } from "./support/criar-cliente";

const admin = adminLocal();

function linhaSucessoSeed(page: import("@playwright/test").Page) {
  return page.getByRole("row").filter({ hasText: "funcionario.sn@rigonicontabil.local" });
}

function linhaFalhaSeed(page: import("@playwright/test").Page) {
  return page.getByRole("row").filter({ hasText: "CNPJ de teste" });
}

test.describe("Feed de auditoria (Admin only)", () => {
  test.beforeEach(async () => {
    const { error } = await admin
      .from("registros_auditoria")
      .update({ criado_em: new Date().toISOString() })
      .in("id", ["77777777-7777-7777-7777-777777777777", "66666666-6666-6666-6666-666666666666"]);
    if (error) throw error;
  });

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
    await expect(page).toHaveURL("/simples-nacional");

    await page.goto("/admin/auditoria");

    await expect(page).toHaveURL("/simples-nacional");
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
