import { expect, test } from "./fixtures";
import { login } from "./support/criar-cliente";

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

test.describe("Foto do avatar em Meu perfil", () => {
  test("o Funcionário envia a foto, o cabeçalho passa a usá-la e ao remover volta à logo @smoke", async ({
    page,
  }) => {
    await login(page, "funcionario.sn@rigonicontabil.local", "func123");
    await expect(page).toHaveURL("/simples-nacional");
    await page.goto("/perfil");

    const avatar = page.getByRole("link", { name: "Ir para o início" }).locator("img");
    await expect(avatar).toHaveAttribute("src", /logo-simples-nacional/);
    await expect(
      page.getByText("Sua foto fica guardada no sistema e só você a vê. Remova quando quiser."),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Remover foto" })).toHaveCount(0);

    await page
      .getByLabel("Escolher foto")
      .setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: PNG_1X1 });
    await page.getByRole("button", { name: "Salvar foto" }).click();

    await expect(page.getByRole("button", { name: "Remover foto" })).toBeVisible();
    await expect(avatar).toHaveAttribute("src", /\/api\/avatar\?v=/);
    const resposta = await page.request.get((await avatar.getAttribute("src")) ?? "");
    expect(resposta.status()).toBe(200);
    expect(resposta.headers()["content-type"]).toBe("image/webp");
    expect(resposta.headers()["cache-control"]).toMatch(/private/);

    await page.getByRole("button", { name: "Remover foto" }).click();

    await expect(page.getByRole("button", { name: "Remover foto" })).toHaveCount(0);
    await expect(avatar).toHaveAttribute("src", /logo-simples-nacional/);
    await expect(page.getByLabel("Escolher foto")).toBeFocused();
  });

  test("formato que o sistema não aceita é avisado sem enviar nada", async ({ page }) => {
    await login(page, "funcionario.sn@rigonicontabil.local", "func123");
    await expect(page).toHaveURL("/simples-nacional");
    await page.goto("/perfil");

    await page
      .getByLabel("Escolher foto")
      .setInputFiles({ name: "foto.gif", mimeType: "image/gif", buffer: Buffer.from("GIF89a") });

    await expect(page.getByRole("region", { name: "Sua foto" }).getByRole("alert")).toContainText(
      "JPEG, PNG ou WebP",
    );
    await expect(page.getByRole("button", { name: "Salvar foto" })).toHaveCount(0);
  });

  test("o Admin também envia e remove a própria foto, e sem foto volta à logo do escritório", async ({
    page,
  }) => {
    await login(page, "admin@rigonicontabil.local", "admin123");
    await expect(page).toHaveURL("/");
    await page.goto("/perfil");

    const avatar = page.getByRole("link", { name: "Ir para o início" }).locator("img");
    await expect(avatar).toHaveAttribute("src", /logo-rigoni/);

    await page
      .getByLabel("Escolher foto")
      .setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: PNG_1X1 });
    await page.getByRole("button", { name: "Salvar foto" }).click();

    await expect(page.getByRole("button", { name: "Remover foto" })).toBeVisible();
    await expect(avatar).toHaveAttribute("src", /\/api\/avatar\?v=/);

    await page.getByRole("button", { name: "Remover foto" }).click();

    await expect(page.getByRole("button", { name: "Remover foto" })).toHaveCount(0);
    await expect(avatar).toHaveAttribute("src", /logo-rigoni/);
  });
});
