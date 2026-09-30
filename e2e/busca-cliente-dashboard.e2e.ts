import { expect, test } from "@playwright/test";

// Cobre o cenário principal do ticket #35 (Busca de cliente no dashboard):
// encontrar um cliente pelo nome na seção de busca do corpo da página `/` e
// editar o cadastro operacional inline, sem navegar pra /clientes/[id].
// Usuários: supabase/seed.sql, ambiente Dev local.

async function login(page: import("@playwright/test").Page, email: string, senha: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(senha);
  await page.getByRole("button", { name: "Entrar" }).click();
}

function pdf(nome: string) {
  return { name: nome, mimeType: "application/pdf", buffer: Buffer.from("conteúdo de teste") };
}

const PESOS_PRIMEIRO_DIGITO = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const PESOS_SEGUNDO_DIGITO = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

function digitoVerificador(base: string, pesos: number[]): string {
  const soma = base
    .split("")
    .reduce((acumulado, digito, indice) => acumulado + Number(digito) * pesos[indice], 0);
  const resto = soma % 11;
  return String(resto < 2 ? 0 : 11 - resto);
}

function cnpjUnico(): string {
  const raiz = `${Date.now()}`.slice(-8) + "0001";
  const d1 = digitoVerificador(raiz, PESOS_PRIMEIRO_DIGITO);
  const d2 = digitoVerificador(raiz + d1, PESOS_SEGUNDO_DIGITO);
  return raiz + d1 + d2;
}

async function criarClienteComoAdmin(page: import("@playwright/test").Page, empresa: string) {
  const cnpjDigits = cnpjUnico();
  await login(page, "admin@rigonicontabil.local", "admin123");
  await expect(page).toHaveURL("/");
  await page.goto("/admin/clientes/novo");

  await page.getByLabel("Empresa").fill(empresa);
  await page.getByLabel("CNPJ").fill(cnpjDigits);
  await page.getByLabel("Regime").selectOption("simples_nacional");
  await page.getByLabel("Contrato social").setInputFiles(pdf("contrato-social.pdf"));
  await page.getByRole("button", { name: "Cadastrar" }).click();

  await expect(page.getByText(empresa)).toBeVisible();
  return cnpjDigits;
}

test.describe("Busca de cliente no dashboard (#35)", () => {
  test("Funcionário SN encontra um cliente pela busca e edita o cadastro operacional inline", async ({
    page,
  }) => {
    const empresa = "Busca Dashboard E2E Ltda";
    await criarClienteComoAdmin(page, empresa);

    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/login$/);

    await login(page, "funcionario.sn@rigonicontabil.local", "func123");
    await expect(page).toHaveURL("/");

    await page.getByLabel(/empresa ou cnpj/i).fill(empresa.slice(0, 10));
    await expect(page.getByText(empresa)).toBeVisible();

    await page.getByText(empresa).click();

    await expect(page.getByRole("heading", { name: "Editar cadastro operacional" })).toBeVisible();
    await expect(page).toHaveURL("/");
  });
});
