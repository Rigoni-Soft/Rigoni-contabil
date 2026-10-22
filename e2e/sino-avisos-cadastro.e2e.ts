import { expect, test, type Page } from "@playwright/test";

import { criarClienteComoAdmin, empresaUnica, login } from "./support/criar-cliente";

const SINO = /Avisos de cadastro/;

async function entrarComoLider(page: Page) {
  await login(page, "lider.sn@rigonicontabil.local", "lider123");
  await expect(page).toHaveURL("/simples-nacional");
}

// Sem selo = zero não vistos.
async function naoVistos(page: Page): Promise<number> {
  const selo = page.getByTestId("selo-avisos");
  return (await selo.count()) === 0 ? 0 : Number((await selo.textContent()) ?? 0);
}

test.describe("Sino de Avisos de cadastro (#143)", () => {
  test("Líder vê o aviso de novo Cliente; abrir não marca; o clique marca e leva ao Cliente @smoke", async ({
    page,
    browser,
  }) => {
    const empresa = empresaUnica("Sino E2E Ltda");
    const admin = await (await browser.newContext()).newPage();
    await criarClienteComoAdmin(admin, empresa);

    await entrarComoLider(page);
    await expect.poll(() => naoVistos(page)).toBeGreaterThan(0);
    const antes = await naoVistos(page);

    // Abrir o modal não marca nada como visto.
    await page.getByRole("button", { name: SINO }).click();
    const aviso = page
      .getByRole("button", { name: /Novo Cliente no Cadastro operacional/ })
      .first();
    await expect(aviso).toHaveAttribute("data-visto", "false");
    expect(await naoVistos(page)).toBe(antes);

    // O clique marca como visto e leva ao formulário do Cliente.
    await aviso.click();
    await expect(page).toHaveURL(/\/clientes\/[0-9a-f-]{36}$/);
    await expect(page.getByLabel("Empresa")).toHaveValue(empresa);
    await expect.poll(() => naoVistos(page)).toBe(antes - 1);
  });

  test("Admin não recebe Aviso de cadastro: o sino fica sem selo", async ({ page }) => {
    await login(page, "admin@rigonicontabil.local", "admin123");
    await expect(page).toHaveURL("/");

    await expect(page.getByRole("button", { name: "Avisos de cadastro" })).toBeVisible();
    await expect(page.getByTestId("selo-avisos")).toHaveCount(0);
  });

  test("polling: aviso criado por outra sessão entra no contador em até 30 s (relógio controlado)", async ({
    page,
    browser,
  }) => {
    await entrarComoLider(page);
    await page.clock.install();
    await page.reload();
    // Linha de base só depois da primeira leitura do contador (sem selo = 0 ou ainda carregando).
    await page.waitForLoadState("networkidle");
    const antes = await naoVistos(page);

    const admin = await (await browser.newContext()).newPage();
    await criarClienteComoAdmin(admin, empresaUnica("Sino Polling E2E Ltda"));

    await page.clock.fastForward(31_000);
    await expect.poll(() => naoVistos(page)).toBe(antes + 1);
  });
});
