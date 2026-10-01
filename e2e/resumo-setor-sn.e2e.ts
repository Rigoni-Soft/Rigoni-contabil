import { expect, test } from "@playwright/test";

import { criarClienteComoAdmin } from "./support/criar-cliente";

// Cobre o cenário principal do ticket #36 (Resumo do setor, 9 cards):
// cliente novo nasce com documento_obrigatorio='negativo' (#34, cadastro
// automático), então cai no card "Sem documento" — cenário previsível sem
// precisar editar nada antes do teste. Clicar no card abre uma tela própria
// (/clientes/resumo/[bucket]), não um painel inline (decisão de UX revisada).

test.describe("Resumo do setor (#36)", () => {
  test("o card 'Sem documento' leva a uma tela própria com o cliente recém-cadastrado, que leva ao cadastro dele", async ({
    page,
  }) => {
    const empresa = "Resumo Setor E2E Ltda";
    await criarClienteComoAdmin(page, empresa);

    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Resumo do setor" })).toBeVisible();
    await page.getByRole("link", { name: /Sem documento/ }).click();

    await expect(page.getByRole("heading", { name: "Sem documento" })).toBeVisible();
    await expect(page).toHaveURL(/\/clientes\/resumo\/sem_documento$/);

    const linha = page.getByRole("link").filter({ hasText: empresa });
    await expect(linha).toBeVisible();
    await linha.click();

    await expect(page.getByRole("heading", { name: "Editar cadastro operacional" })).toBeVisible();

    await page.getByRole("link", { name: "Voltar" }).click();
    await expect(page.getByRole("heading", { name: "Resumo do setor" })).toBeVisible();
  });
});
