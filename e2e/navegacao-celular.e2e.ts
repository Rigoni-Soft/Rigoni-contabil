import { expect, test } from "./fixtures";
import { login } from "./support/criar-cliente";

// No celular (abaixo de 640 px) o cabeçalho é uma barra de uma linha: nome, sino e o botão Menu, que
// abre Perfil, tema, Sair (e as ações do Admin). O Admin troca os chips de Setor por um seletor.
const FUNCIONARIO = ["funcionario2.financeiro@rigonicontabil.local", "func123"] as const;
const LIDER = ["lider.contabil@rigonicontabil.local", "lider123"] as const;
const ADMIN = ["admin@rigonicontabil.local", "admin123"] as const;

test.describe("Navegação no celular", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("o Funcionário abre o menu com Perfil, tema e Sair; Esc fecha e o foco volta ao botão @smoke", async ({
    page,
  }) => {
    await login(page, ...FUNCIONARIO);
    await expect(page).toHaveURL("/");

    const menu = page.getByRole("button", { name: "Menu" });
    await expect(page.getByRole("link", { name: "Meu perfil" })).toBeHidden();
    await menu.click();

    await expect(page.getByRole("link", { name: "Meu perfil" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Meu perfil" })).toContainText("Meu perfil");
    await expect(page.getByRole("button", { name: /Mudar para tema/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sair" })).toBeVisible();
    // Funcionário não cadastra ninguém: sem os links de cadastro.
    await expect(page.getByRole("link", { name: /Cadastrar/ })).toHaveCount(0);

    await page.keyboard.press("Escape");
    await expect(page.getByRole("link", { name: "Meu perfil" })).toBeHidden();
    await expect(menu).toBeFocused();

    // O sino fica fora do menu, sempre à vista.
    await expect(page.getByRole("button", { name: /Avisos/ })).toBeVisible();
    const altura = await page.evaluate(
      () => document.querySelector("header")!.getBoundingClientRect().height,
    );
    expect(altura).toBeLessThan(80);
  });

  test("o Líder vê Cadastrar Funcionário no menu", async ({ page }) => {
    await login(page, ...LIDER);
    await expect(page).toHaveURL("/");
    await page.getByRole("button", { name: "Menu" }).click();

    await expect(page.getByRole("link", { name: "Cadastrar Funcionário" })).toBeVisible();
  });

  test("o Admin tem todas as ações no menu e troca os chips por um seletor de Setor @smoke", async ({
    page,
  }) => {
    await login(page, ...ADMIN);
    await expect(page).toHaveURL("/");

    await page.getByRole("button", { name: "Menu" }).click();
    for (const nome of [
      "Cadastrar Líder",
      "Cadastrar Cliente",
      "Usuários",
      "Feriados",
      "Meu perfil",
    ]) {
      await expect(page.getByRole("link", { name: nome })).toBeVisible();
    }
    await page.keyboard.press("Escape");

    const seletor = page.getByRole("combobox", { name: "Ir para o Setor" });
    await expect(seletor).toBeVisible();
    // Em "/" nenhum Setor está aberto: o seletor mostra o título, não o primeiro Setor.
    await expect(seletor).toHaveValue("");
    await expect(seletor.locator("option:checked")).toHaveText("Setor");
    // Os chips de Setor somem no celular; Atendimento segue à vista.
    await expect(page.getByRole("link", { name: "Simples Nacional", exact: true })).toBeHidden();
    await expect(page.getByRole("link", { name: "Atendimento", exact: true })).toBeVisible();

    await seletor.selectOption("simples_nacional");
    await expect(page).toHaveURL("/simples-nacional");
    await expect(page.getByRole("combobox", { name: "Ir para o Setor" })).toHaveValue(
      "simples_nacional",
    );
  });

  test("a 320 px não há rolagem horizontal, com o menu aberto, em nenhum Papel", async ({
    browser,
  }) => {
    for (const [email, senha] of [FUNCIONARIO, LIDER, ADMIN]) {
      const ctx = await browser.newContext({
        viewport: { width: 320, height: 640 },
        hasTouch: true,
      });
      const page = await ctx.newPage();
      await login(page, email, senha);
      await expect(page).toHaveURL(/\/(simples-nacional)?$/);
      await page.getByRole("button", { name: "Menu" }).click();
      await expect(page.getByRole("link", { name: "Meu perfil" })).toBeVisible();
      const sobra = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      expect(sobra).toBe(false);
      await ctx.close();
    }
  });
});

test.describe("Navegação em tablet e desktop", () => {
  test("de 640 px para cima não há botão Menu: as ações ficam na linha, como antes", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 768, height: 900 });
    await login(page, ...ADMIN);
    await expect(page).toHaveURL("/");

    await expect(page.getByRole("button", { name: "Menu" })).toBeHidden();
    await expect(page.getByRole("link", { name: "Meu perfil" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Simples Nacional", exact: true })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Ir para o Setor" })).toBeHidden();
  });
});
