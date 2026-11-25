import { test as base, expect, type BrowserContext, type Page } from "@playwright/test";

const TETO_DA_ESPERA_DE_REDE_EM_MS = 5_000;

export async function esperarHidratacao(page: Page) {
  await page
    .waitForLoadState("networkidle", { timeout: TETO_DA_ESPERA_DE_REDE_EM_MS })
    .catch(() => undefined);
}

export const test = base.extend<{ contextosDoTeste: void }>({
  contextosDoTeste: [
    async ({ browser }, usar) => {
      const abertos: BrowserContext[] = [];
      const original = browser.newContext.bind(browser);
      browser.newContext = async (opcoes) => {
        const contexto = await original(opcoes);
        abertos.push(contexto);
        return contexto;
      };
      await usar();
      browser.newContext = original;
      await Promise.all(abertos.map((c) => c.close().catch(() => undefined)));
    },
    { auto: true },
  ],
  page: async ({ page }, usar) => {
    const irPara = page.goto.bind(page);
    page.goto = async (url, opcoes) => {
      const resposta = await irPara(url, opcoes);
      await esperarHidratacao(page);
      return resposta;
    };
    await usar(page);
  },
});

export { expect };
