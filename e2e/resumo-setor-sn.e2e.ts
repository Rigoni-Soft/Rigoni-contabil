import { expect, test } from "@playwright/test";

import { criarClienteComoAdmin } from "./support/criar-cliente";

// Cobre o cenário principal do ticket #36 (Resumo do setor, 9 cards):
// cliente novo nasce com documento_obrigatorio='negativo' (#34, cadastro
// automático), então cai no card "Sem documento" — cenário previsível sem
// precisar editar nada antes do teste.

test.describe("Resumo do setor (#36)", () => {
  test("o card 'Sem documento' mostra o cliente recém-cadastrado e leva ao cadastro operacional dele", async ({
    page,
  }) => {
    const empresa = "Resumo Setor E2E Ltda";
    await criarClienteComoAdmin(page, empresa);

    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Resumo do setor" })).toBeVisible();
    const card = page.getByRole("button", { name: /Sem documento/ });
    await expect(card).toBeVisible();
    await card.click();

    const linha = page.getByRole("listitem").filter({ hasText: empresa });
    await expect(linha).toBeVisible();

    await linha.getByRole("button", { name: "Ver cadastro" }).click();

    await expect(page.getByRole("heading", { name: "Editar cadastro operacional" })).toBeVisible();

    await page.getByRole("button", { name: "Voltar ao resumo" }).click();
    await expect(page.getByRole("heading", { name: "Resumo do setor" })).toBeVisible();
  });
});
