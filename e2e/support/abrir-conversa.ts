import { expect, type Page } from "@playwright/test";

// A conversa não tem rota própria: abre no centro da tela Atendimento. Este é o caminho do usuário
// até ela, pela aba "Em atendimento" (os Atendimentos que ele assumiu).
export async function abrirConversaEmAtendimento(page: Page, contato: RegExp | string) {
  await page.goto("/atendimento");
  await page.getByRole("tab", { name: /Em atendimento/ }).click();
  await page.getByRole("button", { name: contato }).click();
  await expect(page.getByLabel("Mensagem ao cliente")).toBeVisible();
}
