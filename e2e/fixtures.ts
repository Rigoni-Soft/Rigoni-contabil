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
      await page.waitForLoadState("networkidle");
      return resposta;
    };
    await usar(page);
  },
});

export { expect };
