import { test as base, expect, type BrowserContext } from "@playwright/test";

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
      await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
      return resposta;
    };
    await usar(page);
  },
});

export { expect };
