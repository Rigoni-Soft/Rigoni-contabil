import { expect, test } from "./fixtures";
import { login } from "./support/criar-cliente";

const EMAIL = "admin@rigonicontabil.local";
const SENHA = "admin123";

test.describe("Login e shell autenticado", () => {
  test("visitante sem sessão é redirecionado para /login @smoke", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("credenciais inválidas mostram erro e mantêm o visitante em /login @smoke", async ({
    page,
  }) => {
    await login(page, EMAIL, "senha-errada");

    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("usuário já autenticado que visita /login é redirecionado pra /", async ({ page }) => {
    await login(page, EMAIL, SENHA);
    await expect(page).toHaveURL("/");

    await page.goto("/login");

    await expect(page).toHaveURL("/");
  });

  test("Admin: login, shell mostra papel/setor, nav lista todos os setores, logout @smoke", async ({
    page,
  }) => {
    await login(page, EMAIL, SENHA);

    await expect(page).toHaveURL("/");
    await expect(page.getByText("Admin de Teste")).toBeVisible();
    await expect(page.getByText(/acesso a todos os setores/i)).toBeVisible();

    // De 640 px para cima são chips; o <option> do seletor do celular existe, mas está oculto.
    const nav = page.getByRole("navigation", { name: "Setores" });
    await expect(nav.getByText("Simples Nacional").filter({ visible: true })).toBeVisible();
    await expect(nav.getByText("Financeiro").filter({ visible: true })).toBeVisible();
    await expect(
      nav.getByText("Contábil", { exact: true }).filter({ visible: true }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("Funcionário: shell mostra o próprio setor, nav mostra só o próprio setor", async ({
    page,
  }) => {
    await login(page, "funcionario.sn@rigonicontabil.local", "func123");

    // Simples Nacional é a página principal do próprio setor: o login cai direto lá, não em "/".
    await expect(page).toHaveURL("/simples-nacional");
    await expect(page.getByText(/Setor: Simples Nacional/)).toBeVisible();

    const nav = page.getByRole("navigation", { name: "Setores" });
    await expect(nav.getByText("Simples Nacional")).toBeVisible();
    await expect(nav.getByText("Financeiro")).not.toBeVisible();
    await expect(nav.getByText("Contábil")).not.toBeVisible();
  });

  test("Líder de setor: shell mostra o próprio setor, nav mostra só o próprio setor", async ({
    page,
  }) => {
    await login(page, "lider.contabil@rigonicontabil.local", "lider123");

    await expect(page).toHaveURL("/");
    await expect(page.getByText(/Setor: Contábil/)).toBeVisible();

    const nav = page.getByRole("navigation", { name: "Setores" });
    await expect(nav.getByText("Contábil")).toBeVisible();
    await expect(nav.getByText("Simples Nacional")).not.toBeVisible();
    await expect(nav.getByText("Financeiro")).not.toBeVisible();
  });
});
