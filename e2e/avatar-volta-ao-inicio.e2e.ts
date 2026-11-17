import { expect, test } from "./fixtures";
import { login } from "./support/criar-cliente";

// O avatar do cabeçalho é o caminho de volta à home de qualquer tela autenticada.
test.describe("Avatar leva ao início", () => {
  test("o Admin entra em /rh pela aba, clica no avatar e chega a / com a busca de clientes à vista @smoke", async ({
    page,
  }) => {
    await login(page, "admin@rigonicontabil.local", "admin123");
    await expect(page).toHaveURL("/");

    await page.getByRole("link", { name: "RH", exact: true }).click();
    await expect(page).toHaveURL("/rh");
    await page.getByRole("link", { name: "Ir para o início" }).click();

    await expect(page).toHaveURL("/");
    await expect(page.getByLabel(/empresa ou cnpj/i)).toBeVisible();
  });

  test("o Funcionário do Simples Nacional abre /perfil, clica no avatar e chega a /simples-nacional @smoke", async ({
    page,
  }) => {
    await login(page, "funcionario.sn@rigonicontabil.local", "func123");
    await expect(page).toHaveURL("/simples-nacional");

    await page.goto("/perfil");
    await page.getByRole("link", { name: "Ir para o início" }).click();

    await expect(page).toHaveURL("/simples-nacional");
  });
});
