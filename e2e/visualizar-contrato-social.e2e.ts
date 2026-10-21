import { expect, test, type Page } from "@playwright/test";

import {
  atribuirResponsavelComoLider,
  cnpjUnico,
  criarClienteComoAdmin,
  empresaUnica,
  login,
  pdf,
} from "./support/criar-cliente";

async function sair(page: Page) {
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/login$/);
}

async function entrarEm(page: Page, email: string, senha: string) {
  await login(page, email, senha);
  await expect(page).toHaveURL("/simples-nacional");
}

async function abrirCliente(page: Page, empresa: string) {
  await page.getByLabel(/empresa ou cnpj/i).fill(empresa);
  await page.getByText(empresa).click();
}

test.describe("Visualizar contrato social e alterações (#140)", () => {
  test("sem alteração o botão é 'Visualizar contrato social' e o Responsável abre o documento @smoke", async ({
    page,
  }) => {
    const empresa = empresaUnica("Visualizar Contrato E2E Ltda");
    const cnpjDigits = await criarClienteComoAdmin(page, empresa);
    await atribuirResponsavelComoLider(cnpjDigits);
    await sair(page);

    await entrarEm(page, "funcionario.sn@rigonicontabil.local", "func123");
    await abrirCliente(page, empresa);
    await page.getByRole("button", { name: "Visualizar contrato social" }).click();
    // O arquivo é baixado/visualizado na nova aba: o que se confere é a requisição ao link assinado.
    const [requisicao] = await Promise.all([
      page
        .context()
        .waitForEvent("request", (r) => r.url().includes("/object/sign/documentos-clientes/")),
      page.getByRole("button", { name: /^Abrir / }).click(),
    ]);

    expect(requisicao.url()).toContain("token=");
  });

  test("com alteração o Líder vê a de maior nº em destaque e o seletor das demais", async ({
    page,
  }) => {
    const empresa = empresaUnica("Visualizar Alteracao E2E Ltda");
    await login(page, "admin@rigonicontabil.local", "admin123");
    await expect(page).toHaveURL("/");
    await page.goto("/admin/clientes/novo");
    await page.getByLabel("Empresa").fill(empresa);
    await page.getByLabel("CNPJ").fill(cnpjUnico());
    await page.getByLabel("Regime").selectOption("simples_nacional");
    await page.getByLabel("Contrato social").setInputFiles(pdf("contrato-social.pdf"));
    await page.getByRole("button", { name: "Adicionar" }).click();
    await page.getByLabel("Data da alteração 1").fill("2026-02-01");
    await page.getByLabel("Arquivo da alteração 1").setInputFiles(pdf("1-alteracao.pdf"));
    await page.getByRole("button", { name: "Adicionar" }).click();
    await page.getByLabel("Data da alteração 2").fill("2026-03-01");
    await page.getByLabel("Arquivo da alteração 2").setInputFiles(pdf("2-alteracao.pdf"));
    await page.getByRole("button", { name: "Cadastrar" }).click();
    await expect(page.getByText(empresa)).toBeVisible();
    await sair(page);

    await entrarEm(page, "lider.sn@rigonicontabil.local", "lider123");
    await abrirCliente(page, empresa);
    await page.getByRole("button", { name: "Visualizar alteração" }).click();

    await expect(
      page.getByText("Alteração nº 2 - 01/03/2026", { exact: true }).first(),
    ).toBeVisible();
    await expect(page.getByLabel("Escolher documento").locator("option")).toHaveCount(3);

    const [requisicao] = await Promise.all([
      page
        .context()
        .waitForEvent("request", (r) => r.url().includes("/object/sign/documentos-clientes/")),
      page.getByRole("button", { name: /^Abrir / }).click(),
    ]);
    expect(requisicao.url()).toContain("token=");
  });

  test("na tela própria do Cliente o botão já chega com a carga do servidor", async ({ page }) => {
    const cnpjDigits = await criarClienteComoAdmin(page, "Visualizar Tela Propria E2E Ltda");
    const clienteId = await atribuirResponsavelComoLider(cnpjDigits);
    await sair(page);

    await entrarEm(page, "lider.sn@rigonicontabil.local", "lider123");
    await page.goto(`/clientes/${clienteId}`);

    await expect(page.getByRole("button", { name: "Visualizar contrato social" })).toBeVisible();
  });

  test("Funcionário que não é Responsável não chega ao documento", async ({ page }) => {
    const cnpjDigits = await criarClienteComoAdmin(page, "Visualizar Negado E2E Ltda");
    const clienteId = await atribuirResponsavelComoLider(cnpjDigits);
    await sair(page);

    await entrarEm(page, "funcionario2.sn@rigonicontabil.local", "func123");
    await page.goto(`/clientes/${clienteId}`);

    await expect(page).toHaveURL("/simples-nacional");
    await expect(
      page.getByRole("button", { name: /Visualizar (alteração|contrato social)/ }),
    ).toBeHidden();
  });
});
