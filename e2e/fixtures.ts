import { test as base, expect } from "@playwright/test";

// `goto` espera a hidratação: o `next dev` frio do CI serve o HTML antes de o
// React hidratar, e preencher antes disso faz o React Hook Form reaplicar os
// valores iniciais por cima do digitado (ou o submit sair como nativo). Vale
// para todo e2e que use este `test` em vez do de `@playwright/test`.
export const test = base.extend({
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
