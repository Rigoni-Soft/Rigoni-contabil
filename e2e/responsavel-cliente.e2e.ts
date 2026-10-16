import { expect, test, type Page } from "@playwright/test";

import {
  atribuirResponsavelComoLider,
  criarClienteComoAdmin,
  empresaUnica,
  login,
} from "./support/criar-cliente";

async function sair(page: Page) {
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/login$/);
}

async function entrarEm(page: Page, email: string, senha: string) {
  await login(page, email, senha);
  await expect(page).toHaveURL("/simples-nacional");
}

test.describe("Responsável por Cliente (#65)", () => {
  test("Líder atribui o Responsável pela busca; só o Funcionário responsável enxerga o Cliente @smoke", async ({
    page,
  }) => {
    const empresa = empresaUnica("Responsavel E2E Ltda");
    await criarClienteComoAdmin(page, empresa);
    await sair(page);

    await entrarEm(page, "lider.sn@rigonicontabil.local", "lider123");
    await page.getByLabel(/empresa ou cnpj/i).fill(empresa);
    await page.getByText(empresa).click();
    await expect(page.getByLabel("Responsável", { exact: true })).toHaveValue("");
    // A lista de Funcionários só é buscada quando o Select recebe foco (lazy).
    const responsavel = page.getByLabel("Responsável", { exact: true });
    await responsavel.focus();
    await responsavel.selectOption({ label: "Funcionário Simples Nacional" });
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByRole("heading", { name: "Editar cadastro operacional" })).toBeHidden();
    await sair(page);

    await entrarEm(page, "funcionario.sn@rigonicontabil.local", "func123");
    await page.getByLabel(/empresa ou cnpj/i).fill(empresa);
    await page.getByText(empresa).click();
    // Funcionário vê o Responsável, mas não edita.
    await expect(page.getByLabel("Responsável", { exact: true })).toBeDisabled();
    await expect(page.getByLabel("Responsável", { exact: true })).toHaveValue(
      "Funcionário Simples Nacional",
    );
    await sair(page);

    await entrarEm(page, "funcionario2.sn@rigonicontabil.local", "func123");
    await page.getByLabel(/empresa ou cnpj/i).fill(empresa);
    await expect(page.getByText(empresa)).toBeHidden();
  });

  test("Funcionário não acessa por URL direta o Cliente de outro Responsável", async ({ page }) => {
    const cnpjDigits = await criarClienteComoAdmin(page, "Responsavel URL E2E Ltda");
    const clienteId = await atribuirResponsavelComoLider(cnpjDigits);
    await sair(page);

    await entrarEm(page, "funcionario2.sn@rigonicontabil.local", "func123");
    await page.goto(`/clientes/${clienteId}`);

    // Sem acesso: cai de volta no dashboard, nunca no formulário.
    await expect(page).toHaveURL("/simples-nacional");
    await expect(page.getByRole("heading", { name: /cadastro operacional/i })).toBeHidden();
  });

  test("Líder vê o 4º comparativo; Funcionário continua com 3", async ({ page }) => {
    const cnpjDigits = await criarClienteComoAdmin(page, "Responsavel Grafico E2E Ltda");
    await atribuirResponsavelComoLider(cnpjDigits);
    await sair(page);

    await entrarEm(page, "lider.sn@rigonicontabil.local", "lider123");
    await expect(page.getByRole("group", { name: "Envio de DAS por Responsável" })).toBeVisible();
    await sair(page);

    await entrarEm(page, "funcionario.sn@rigonicontabil.local", "func123");
    await expect(page.getByRole("group", { name: "Atividade do mês" })).toBeVisible();
    await expect(page.getByRole("group", { name: "Envio de DAS por Responsável" })).toBeHidden();
  });
});
