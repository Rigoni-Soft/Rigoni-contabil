import { expect, test } from "@playwright/test";

import { criarClienteComoAdmin } from "./support/criar-cliente";

// Cliente novo nasce com DAS "pendente", então a contagem do DAS sobe sem depender de edição.
test.describe("Comparativos do dashboard (#37)", () => {
  test("o dashboard do SN mostra os 3 gráficos comparativos @smoke", async ({ page }) => {
    await criarClienteComoAdmin(page, "Comparativos E2E Ltda");

    await page.goto("/");
    await page.getByRole("link", { name: "Simples Nacional" }).click();
    await expect(page).toHaveURL(/\/simples-nacional$/);

    await expect(page.getByRole("heading", { name: "Comparativos" })).toBeVisible();
    const das = page.getByRole("group", { name: "Status do DAS" });
    await expect(das).toBeVisible();
    await expect(das.getByText("Pendente")).toBeVisible();
    await expect(page.getByRole("group", { name: "Status do parcelamento" })).toBeVisible();
    await expect(page.getByRole("group", { name: "Atividade do mês" })).toBeVisible();
  });
});
