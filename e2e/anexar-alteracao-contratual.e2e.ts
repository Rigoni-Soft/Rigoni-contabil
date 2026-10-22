import { expect, test, type Page } from "@playwright/test";

import {
  atribuirResponsavelComoLider,
  cnpjUnico,
  empresaUnica,
  login,
  pdf,
} from "./support/criar-cliente";

async function sair(page: Page) {
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/login$/);
}

// Admin cadastra um Cliente SN com a alteração nº 1; devolve o id para abrir /clientes/[id].
async function criarClienteComAlteracao1(page: Page, empresa: string): Promise<string> {
  const cnpj = cnpjUnico();
  await login(page, "admin@rigonicontabil.local", "admin123");
  await expect(page).toHaveURL("/");
  await page.goto("/admin/clientes/novo");
  await page.getByLabel("Empresa").fill(empresa);
  await page.getByLabel("CNPJ").fill(cnpj);
  await page.getByLabel("Regime").selectOption("simples_nacional");
  await page.getByRole("button", { name: "Adicionar" }).click();
  await page.getByLabel("Data da alteração 1").fill("2026-02-01");
  await page.getByLabel("Arquivo da alteração 1").setInputFiles(pdf("1-alteracao.pdf"));
  await page.getByRole("button", { name: "Cadastrar" }).click();
  await expect(page.getByText(empresa)).toBeVisible();
  return atribuirResponsavelComoLider(cnpj);
}

test.describe("Admin anexa alteração contratual a Cliente existente (#141)", () => {
  test("anexa a alteração nº 2 com nº sugerido, barra o nº repetido e avisa a divergência @smoke", async ({
    page,
  }) => {
    const clienteId = await criarClienteComAlteracao1(
      page,
      empresaUnica("Anexar Alteracao E2E Ltda"),
    );
    await page.goto(`/clientes/${clienteId}`);
    // O cartão do documento mostra sempre a alteração mais recente.
    const cartao = page.getByRole("button", { name: /^Abrir / });
    await expect(cartao).toHaveAccessibleName("Abrir em nova aba: Alteração nº 1 - 01/02/2026");

    await page.getByRole("button", { name: "Anexar alteração", exact: true }).click();
    const dialogo = page.getByRole("dialog", { name: "Anexar alteração contratual" });
    await dialogo.getByLabel(/^Arquivo/).setInputFiles(pdf("2-alteracao.pdf"));
    await expect(dialogo.getByLabel("Nº da alteração")).toHaveValue("2");
    await dialogo.getByLabel("Data da alteração").fill("2026-03-01");
    await dialogo.getByRole("button", { name: "Anexar", exact: true }).click();

    await expect(cartao).toHaveAccessibleName("Abrir em nova aba: Alteração nº 2 - 01/03/2026");
    await expect(dialogo).toBeHidden();

    // Nº repetido: barrado pela lista já carregada, sem subir o arquivo.
    await page.getByRole("button", { name: "Anexar alteração", exact: true }).click();
    await dialogo.getByLabel(/^Arquivo/).setInputFiles(pdf("2-outra.pdf"));
    await dialogo.getByLabel("Data da alteração").fill("2026-04-01");
    await dialogo.getByRole("button", { name: "Anexar", exact: true }).click();
    await expect(dialogo.getByText("Já existe a alteração nº 2 deste Cliente.")).toBeVisible();

    // Divergência nº × data: só avisa, não bloqueia.
    await dialogo.getByLabel("Nº da alteração").fill("3");
    await dialogo.getByLabel("Data da alteração").fill("2026-01-01");
    await expect(dialogo.getByText("Data anterior à da alteração nº 2, confere?")).toBeVisible();
  });

  test("Líder e Funcionário Responsável não veem a seção nem o botão", async ({ page }) => {
    const clienteId = await criarClienteComAlteracao1(page, empresaUnica("Anexar Negado E2E Ltda"));
    await sair(page);

    for (const [email, senha] of [
      ["lider.sn@rigonicontabil.local", "lider123"],
      ["funcionario.sn@rigonicontabil.local", "func123"],
    ]) {
      await login(page, email, senha);
      await expect(page).toHaveURL("/simples-nacional");
      await page.goto(`/clientes/${clienteId}`);
      await expect(
        page.getByRole("button", { name: /^Abrir em nova aba: Alteração nº/ }),
      ).toBeVisible();
      await expect(page.getByRole("button", { name: "Anexar alteração" })).toBeHidden();
      await sair(page);
    }
  });
});
