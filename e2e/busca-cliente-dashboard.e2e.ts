import { expect, test } from "@playwright/test";

import {
  atribuirResponsavelComoLider,
  criarClienteComoAdmin,
  empresaUnica,
  login,
} from "./support/criar-cliente";

test.describe("Busca geral (sem restrição de Regime) — feedback do #36, ponto 3", () => {
  test("Admin encontra um cliente de Lucro Presumido na busca de '/'", async ({ page }) => {
    const empresa = empresaUnica("Busca Geral Presumido E2E Ltda");
    await criarClienteComoAdmin(page, empresa, "lucro_presumido");

    await page.goto("/");
    await page.getByLabel(/empresa ou cnpj/i).fill(empresa);

    await expect(page.getByText(empresa)).toBeVisible();
  });
});

// Cobre o cenário principal do ticket #35 (Busca de cliente no dashboard):
// encontrar um cliente pelo nome na seção de busca embutida no dashboard do
// Simples Nacional e editar o cadastro operacional inline, sem navegar pra
// /clientes/[id]. Funcionário SN cai direto em /simples-nacional ao logar —
// é a página principal do setor dele (feedback de teste manual do #36, ponto
// 1), "/" deixou de ser essa tela. Usuários: supabase/seed.sql, ambiente Dev local.

test.describe("Busca de cliente no dashboard (#35)", () => {
  test("Funcionário SN encontra um cliente pela busca e edita o cadastro operacional inline @smoke", async ({
    page,
  }) => {
    const empresa = empresaUnica("Busca Dashboard E2E Ltda");
    const cnpjDigits = await criarClienteComoAdmin(page, empresa);
    await atribuirResponsavelComoLider(cnpjDigits);

    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/login$/);

    await login(page, "funcionario.sn@rigonicontabil.local", "func123");
    await expect(page).toHaveURL("/simples-nacional");

    await page.getByLabel(/empresa ou cnpj/i).fill(empresa);
    await expect(page.getByText(empresa)).toBeVisible();

    await page.getByText(empresa).click();

    await expect(page.getByRole("heading", { name: "Editar cadastro operacional" })).toBeVisible();
    await expect(page).toHaveURL("/simples-nacional");
  });
});
