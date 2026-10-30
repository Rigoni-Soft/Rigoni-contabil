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

  test("Admin não recebe Aviso de cadastro: não vê o sino", async ({ page }) => {
    await login(page, "admin@rigonicontabil.local", "admin123");
    await expect(page).toHaveURL("/");

    await expect(page.getByRole("link", { name: "Meu perfil" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Avisos de cadastro/ })).toHaveCount(0);
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

  test("o modal é modal de verdade: foco preso, Esc fecha e devolve o foco ao sino, o véu fecha", async ({
    page,
  }) => {
    await entrarComoLider(page);
    const sino = page.getByRole("button", { name: SINO });
    const modal = page.getByRole("dialog", { name: "Avisos de cadastro" });

    await sino.click();
    await expect(modal).toBeVisible();
    await expect(page.getByRole("button", { name: "Fechar avisos" })).toBeFocused();

    // O Tab não escapa do modal para a página atrás do véu.
    for (let i = 0; i < 8; i++) await page.keyboard.press("Tab");
    expect(await page.evaluate(() => !!document.activeElement?.closest("dialog"))).toBe(true);

    await page.keyboard.press("Escape");
    await expect(modal).toBeHidden();
    await expect(sino).toBeFocused();

    // Clique no véu (fora da caixa) também fecha.
    await sino.click();
    await expect(modal).toBeVisible();
    await page.mouse.click(5, 5);
    await expect(modal).toBeHidden();
  });
});
