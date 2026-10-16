import { expect, test, type Page } from "@playwright/test";

const SETOR = "condominios";

async function login(page: Page, email: string, senha: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(senha);
  await page.getByRole("button", { name: "Entrar" }).click();
}

async function cadastrarFuncionario(page: Page, nome: string) {
  await page.goto("/admin/usuarios/novo");
  await page.getByLabel("Nome").fill(nome);
  await page
    .getByLabel("E-mail")
    .fill(`e2e-papel-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@rigonicontabil.local`);
  await page.getByLabel("Papel").selectOption("funcionario");
  await page.getByLabel("Setor").selectOption(SETOR);
  await page.getByRole("button", { name: "Cadastrar" }).click();
  await expect(page.locator("p.font-mono")).toBeVisible();
}

test("Admin promove Funcionário a Líder, é barrado num segundo no mesmo Setor e só consegue após rebaixar o primeiro", async ({
  page,
}) => {
  await login(page, "admin@rigonicontabil.local", "admin123");
  await expect(page).toHaveURL("/");

  const primeiro = `Primeiro Papel ${Date.now()}`;
  const segundo = `Segundo Papel ${Date.now()}`;
  await cadastrarFuncionario(page, primeiro);
  await cadastrarFuncionario(page, segundo);

  await page.goto("/admin/usuarios");
  await page.getByRole("button", { name: `Promover ${primeiro} a Líder de setor` }).click();
  await expect(
    page.getByRole("button", { name: `Rebaixar ${primeiro} a Funcionário` }),
  ).toBeVisible();

  await page.getByRole("button", { name: `Promover ${segundo} a Líder de setor` }).click();
  await expect(page.getByText("Rebaixe-o a Funcionário antes de promover outro")).toBeVisible();

  await page.getByRole("button", { name: `Rebaixar ${primeiro} a Funcionário` }).click();
  await expect(
    page.getByRole("button", { name: `Promover ${primeiro} a Líder de setor` }),
  ).toBeVisible();

  await page.getByRole("button", { name: `Promover ${segundo} a Líder de setor` }).click();
  await expect(
    page.getByRole("button", { name: `Rebaixar ${segundo} a Funcionário` }),
  ).toBeVisible();

  // Limpa: deixa o Setor sem Líder pra próxima execução.
  await page.getByRole("button", { name: `Rebaixar ${segundo} a Funcionário` }).click();
  await expect(
    page.getByRole("button", { name: `Promover ${segundo} a Líder de setor` }),
  ).toBeVisible();
});
