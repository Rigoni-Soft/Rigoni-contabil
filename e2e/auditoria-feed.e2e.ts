import { expect, test } from "./fixtures";
import { adminLocal } from "./support/admin-local";

const admin = adminLocal();

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
  // O feed mostra só os 50 registros mais recentes: com o uso, as outras suítes empurram os dois do
  // seed para fora. Rejuvenescê-los mantém o teste independente do que rodou antes.
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
    // Simples Nacional é a página principal do próprio setor.
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
