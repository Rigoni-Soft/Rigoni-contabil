import { expect, test } from "./fixtures";

// Cobre o cenário principal do ticket #30 (Admin cadastra Líder/Funcionário):
// cadastro com senha provisória gerada automaticamente, mostrada na hora.
// Usuários: supabase/seed.sql (Admin de Teste e Funcionário Simples Nacional,
// ambiente Dev local; baseURL vem de playwright.config.ts).

async function login(page: import("@playwright/test").Page, email: string, senha: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(senha);
  await page.getByRole("button", { name: "Entrar" }).click();
}

test.describe("Cadastro de Líder/Funcionário (Admin only)", () => {
  test("Admin cadastra um Funcionário e vê a senha provisória", async ({ page }) => {
    await login(page, "admin@rigonicontabil.local", "admin123");
    await expect(page).toHaveURL("/");
    await page.goto("/admin/usuarios/novo");

    const email = `e2e-${Date.now()}@rigonicontabil.local`;
    await page.getByLabel("Nome").fill("Funcionário E2E");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Papel").selectOption("funcionario");
    await page.getByLabel("Setor").selectOption("financeiro");
    await page.getByRole("button", { name: "Cadastrar" }).click();

    await expect(page.getByText(`Funcionário E2E`)).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();
    // 12 caracteres do alfabeto sem 0/O/1/I (supabase-auth-admin.gateway.ts)
    await expect(page.getByText(/^[A-HJ-NP-Z2-9]{12}$/)).toBeVisible();
  });

  test("'Cadastrar outro' volta pro formulário limpo; 'Finalizar' leva pra home", async ({
    page,
  }) => {
    await login(page, "admin@rigonicontabil.local", "admin123");
    await expect(page).toHaveURL("/");
    await page.goto("/admin/usuarios/novo");

    await page.getByLabel("Nome").fill("Funcionário E2E 2");
    await page.getByLabel("E-mail").fill(`e2e-2-${Date.now()}@rigonicontabil.local`);
    await page.getByLabel("Papel").selectOption("funcionario");
    await page.getByLabel("Setor").selectOption("financeiro");
    await page.getByRole("button", { name: "Cadastrar" }).click();
    await expect(page.getByText(`Funcionário E2E 2`)).toBeVisible();

    await page.getByRole("button", { name: "Cadastrar outro" }).click();
    await expect(page.getByLabel("Nome")).toHaveValue("");
    await expect(page.getByLabel("E-mail")).toHaveValue("");
    await expect(page.getByText(`Funcionário E2E 2`)).not.toBeVisible();

    // Formulário limpo confirmado — cadastra um segundo, aí sim testa "Finalizar"
    // (só existe na tela de confirmação, não no formulário recém-resetado).
    await page.getByLabel("Nome").fill("Funcionário E2E 3");
    await page.getByLabel("E-mail").fill(`e2e-3-${Date.now()}@rigonicontabil.local`);
    await page.getByLabel("Papel").selectOption("funcionario");
    await page.getByLabel("Setor").selectOption("financeiro");
    await page.getByRole("button", { name: "Cadastrar" }).click();
    await expect(page.getByText(`Funcionário E2E 3`)).toBeVisible();

    await page.getByRole("link", { name: "Finalizar" }).click();
    await expect(page).toHaveURL("/");
  });

  test("Funcionário é redirecionado pra fora do cadastro de usuário", async ({ page }) => {
    await login(page, "funcionario.sn@rigonicontabil.local", "func123");
    await expect(page).toHaveURL("/");

    await page.goto("/admin/usuarios/novo");

    await expect(page).toHaveURL("/");
  });
});

// Ticket #32: Líder cadastra Funcionário só do próprio Setor, sem opção de
// escolher outro Setor nem de cadastrar Líder/Admin.
test.describe("Cadastro de Funcionário (Líder de setor)", () => {
  test("Líder cadastra um Funcionário do próprio Setor e vê a senha provisória", async ({
    page,
  }) => {
    await login(page, "lider.contabil@rigonicontabil.local", "lider123");
    await expect(page).toHaveURL("/");
    await page.goto("/admin/usuarios/novo");

    const email = `e2e-lider-${Date.now()}@rigonicontabil.local`;
    await page.getByLabel("Nome").fill("Funcionário Contábil E2E");
    await page.getByLabel("E-mail").fill(email);
    // Papel e Setor já vêm pré-selecionados e travados (só há 1 opção pro Líder).
    await page.getByRole("button", { name: "Cadastrar" }).click();

    await expect(page.getByText(`Funcionário Contábil E2E`)).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();
  });

  test("Líder não vê opção de cadastrar Líder nem de escolher outro Setor — campos já vêm travados", async ({
    page,
  }) => {
    await login(page, "lider.contabil@rigonicontabil.local", "lider123");
    await expect(page).toHaveURL("/");
    await page.goto("/admin/usuarios/novo");

    const papel = page.getByLabel("Papel");
    await expect(papel.locator("option")).toHaveText(["Funcionário"]);
    await expect(papel).toBeDisabled();
    await expect(papel).toHaveValue("funcionario");

    const setor = page.getByLabel("Setor");
    await expect(setor.locator("option")).toHaveText(["contabil"]);
    await expect(setor).toBeDisabled();
    await expect(setor).toHaveValue("contabil");
  });
});
