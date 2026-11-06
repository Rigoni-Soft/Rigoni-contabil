import { test as base, expect, type BrowserContext } from "@playwright/test";

// `goto` espera a hidratação: o `next dev` frio do CI serve o HTML antes de o
// React hidratar, e preencher antes disso faz o React Hook Form reaplicar os
// valores iniciais por cima do digitado (ou o submit sair como nativo). Vale
// para todo e2e que use este `test` em vez do de `@playwright/test`.
export const test = base.extend<{ contextosDoTeste: void }>({
  // `browser.newContext()` não é fechado pelo Playwright ao fim do teste: cada aba extra (Admin,
  // Líder, Responsável…) seguia viva e fazendo polling no preview até o fim da suíte (até 15 min,
  // 8+ abas somadas), o que enchia o app de requisições e deixava a rede sempre ocupada.
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
      // Teto curto: no preview da Vercel a rede nunca fica ociosa (toolbar/telemetria da plataforma),
      // e esperar o timeout do teste inteiro derrubava a suíte por configuração, não por bug.
      await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
      return resposta;
    };
    await usar(page);
  },
});

export { expect };
