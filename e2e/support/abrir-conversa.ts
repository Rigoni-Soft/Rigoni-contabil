import { expect, type Page } from "@playwright/test";

export async function abrirConversaEmAtendimento(page: Page, contato: RegExp | string) {
  await page.goto("/atendimento");
  await page.getByRole("tab", { name: /Em atendimento/ }).click();
  await page.getByRole("button", { name: contato }).click();
  await expect(page.getByLabel("Mensagem ao cliente")).toBeVisible();
}
