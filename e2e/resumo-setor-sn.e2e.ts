import { expect, test } from "@playwright/test";

import {
  atribuirResponsavelComoLider,
  criarClienteComoAdmin,
  empresaUnica,
  login,
} from "./support/criar-cliente";

// Cliente novo nasce com documento_obrigatorio='negativo' (cadastro automático), então cai no card
// "Sem documento" sem precisar editar nada. Clicar no card abre uma tela própria
// (/clientes/resumo/[bucket]), não um painel inline.

test.describe("Resumo do setor (#36)", () => {
  test("o card 'Sem documento' leva a uma tela própria com o cliente recém-cadastrado, que leva ao cadastro dele", async ({
    page,
  }) => {
    const empresa = empresaUnica("Resumo Setor E2E Ltda");
    await criarClienteComoAdmin(page, empresa);

    await page.goto("/");
    await page.getByRole("link", { name: "Simples Nacional" }).click();

    await expect(page.getByRole("heading", { name: "Resumo do setor" })).toBeVisible();
    await expect(page).toHaveURL(/\/simples-nacional$/);
    await page.getByRole("link", { name: /Sem documento/ }).click();

    await expect(page.getByRole("heading", { name: "Sem documento" })).toBeVisible();
    await expect(page).toHaveURL(/\/clientes\/resumo\/sem_documento$/);

    const linha = page.getByRole("link").filter({ hasText: empresa });
    await expect(linha).toBeVisible();
    await linha.click();

    await expect(page.getByRole("heading", { name: "Editar cadastro operacional" })).toBeVisible();

    // "Voltar" leva pra lista do bucket de onde veio, não pro dashboard.
    await page.getByRole("link", { name: "Voltar" }).click();
    await expect(page.getByRole("heading", { name: "Sem documento" })).toBeVisible();
    await expect(page).toHaveURL(/\/clientes\/resumo\/sem_documento$/);

    await page.getByRole("link", { name: "Voltar ao resumo" }).click();
    await expect(page.getByRole("heading", { name: "Resumo do setor" })).toBeVisible();
  });

  // Salvar uma edição fecha a tela e o dashboard reflete a mudança na hora, sem recarregar.
  test("salvar uma edição move o cliente pro bucket certo e fecha a tela de volta pra lista", async ({
    page,
  }) => {
    const empresa = empresaUnica("Resumo Setor Realtime E2E Ltda");
    const cnpjDigits = await criarClienteComoAdmin(page, empresa);
    await atribuirResponsavelComoLider(cnpjDigits);

    await page.getByRole("button", { name: "Sair" }).click();
    await login(page, "funcionario.sn@rigonicontabil.local", "func123");
    await expect(page).toHaveURL("/simples-nacional");

    await page.getByRole("link", { name: /Sem documento/ }).click();
    await page.getByRole("link").filter({ hasText: empresa }).click();

    // Documento recebido vira positivo, DAS continua pendente -> card
    // "DAS pendente" (urgente), não mais "Sem documento".
    await page.getByLabel("Documento recebido").selectOption("positivo");
    await page.getByRole("button", { name: "Salvar" }).click();

    // "Voltar" pro bucket de origem, com a lista já sem o cliente (saiu do
    // bucket "Sem documento" assim que salvou).
    await expect(page).toHaveURL(/\/clientes\/resumo\/sem_documento$/);
    await expect(page.getByText(empresa)).not.toBeVisible();

    await page.getByRole("link", { name: "Voltar ao resumo" }).click();
    await page.getByRole("link", { name: /DAS pendente/ }).click();

    await expect(page.getByText(empresa)).toBeVisible();
  });
});
