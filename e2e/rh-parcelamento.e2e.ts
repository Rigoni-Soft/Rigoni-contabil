import { expect, test } from "./fixtures";
import { adminLocal } from "./support/admin-local";
import { cnpjUnico, login } from "./support/criar-cliente";

// Parcelamento do RH: o Líder do RH cadastra um Parcelamento (com PDF) de Cliente de qualquer Regime,
// o mesmo fluxo do SN; ele é do Setor RH e conta nos cards do dashboard do RH.
const admin = adminLocal();
const EMPRESA = `RH Parcelamento E2E ${Date.now().toString().slice(-6)} Ltda`;
let clienteId = "";

test.describe("Parcelamento na aba do RH", () => {
  test.beforeAll(async () => {
    clienteId = crypto.randomUUID();
    const criado = await admin.from("clientes").insert({
      id: clienteId,
      empresa: EMPRESA,
      cnpj: cnpjUnico(),
      regime: "lucro_presumido",
    });
    if (criado.error) throw criado.error;
  });

  test.afterAll(async () => {
    await admin.from("clientes").delete().eq("id", clienteId);
  });

  test("Líder do RH cadastra um Parcelamento do RH com PDF e ele entra no card do dashboard @smoke", async ({
    page,
  }) => {
    await login(page, "lider.rh@rigonicontabil.local", "lider123");
    await expect(page).toHaveURL("/rh");
    await page.goto(`/clientes/${clienteId}`);
    await expect(page.getByRole("heading", { name: "Editar cadastro operacional" })).toBeVisible();
    // Espera a hidratação: preencher antes dela deixa o React Hook Form reaplicar os valores iniciais.
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
    await expect(
      page.getByRole("status").filter({ hasText: "Tem parcelamento: Não" }),
    ).toBeVisible();

    // O leitor falso (padrão em e2e) sugere FALSO-123456 ao ler o PDF.
    await page.locator("[id='parcelamentos.0.arquivo']").setInputFiles({
      name: "acordo-rh.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 teste"),
    });
    await expect(page.locator("[id='parcelamentos.0.codigo']")).toHaveValue("FALSO-123456");
    await page.locator("[id='parcelamentos.0.parcelasRestantes']").fill("10");
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(page).toHaveURL(/\/(rh)?$/);

    const { data } = await admin
      .from("cliente_parcelamentos")
      .select("setor, codigo, parcelas_restantes")
      .eq("cliente_id", clienteId);
    expect(data).toEqual([{ setor: "rh", codigo: "FALSO-123456", parcelas_restantes: 10 }]);

    // Reaberto, mostra o Parcelamento salvo; o dashboard do RH o conta (pendente: a guia do mês não foi enviada).
    await page.goto(`/clientes/${clienteId}`);
    await expect(
      page.getByRole("status").filter({ hasText: "Tem parcelamento: Sim (1)" }),
    ).toBeVisible();
    await page.goto("/rh");
    await expect(page.getByRole("link", { name: /Parcelamento pendente/ }).first()).toBeVisible();
  });
});
