import { expect, test } from "./fixtures";
import { adminLocal } from "./support/admin-local";
import { cnpjUnico, login } from "./support/criar-cliente";

// Aba do RH (#213): o Líder atribui o Responsável do RH; o Funcionário acha qualquer Cliente, vê só os
// dados básicos e tem no resumo só os atribuídos a ele; funcionário de outro Setor volta para o início.
const admin = adminLocal();
const SUFIXO = `${Date.now()}`.slice(-6);
const EMPRESA = `RH Aba E2E ${SUFIXO} Ltda`;
const FUNCIONARIO_RH_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd";
let clienteId = "";

async function responsavelDoRh() {
  const { data } = await admin
    .from("cliente_responsaveis")
    .select("responsavel_id")
    .eq("cliente_id", clienteId)
    .eq("setor", "rh")
    .maybeSingle();
  return data?.responsavel_id ?? null;
}

test.describe("Aba RH: busca ampla e Responsável do RH (#213)", () => {
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

  test("Líder do RH atribui o Responsável e o Funcionário o vê no resumo e na busca @smoke", async ({
    page,
  }) => {
    await login(page, "lider.rh@rigonicontabil.local", "lider123");
    await expect(page).toHaveURL("/rh");

    await page.getByLabel(/empresa ou cnpj/i).fill(EMPRESA);
    await page.getByText(EMPRESA).click();
    await expect(page.getByRole("heading", { name: "Dados do cliente" })).toBeVisible();

    const campo = page.getByLabel("Responsável", { exact: true });
    await campo.focus();
    await campo.selectOption({ label: "Funcionário RH" });
    await page.getByRole("button", { name: "Salvar Responsável" }).click();
    await expect(page.getByText("Responsável atualizado.")).toBeVisible();
    expect(await responsavelDoRh()).toBe(FUNCIONARIO_RH_ID);

    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/login$/);

    await login(page, "funcionario.rh@rigonicontabil.local", "func123");
    await expect(page).toHaveURL("/rh");
    // O Funcionário não vê o comparativo dos colegas nem os clientes sem Responsável.
    await expect(page.getByRole("heading", { name: "Comparativos" })).toHaveCount(0);
    await expect(page.getByText("Sem responsável")).toHaveCount(0);

    await page.getByLabel(/empresa ou cnpj/i).fill(EMPRESA);
    await page.getByText(EMPRESA).click();
    await expect(page.getByRole("heading", { name: "Dados do cliente" })).toBeVisible();
    await expect(page.getByText(EMPRESA)).toBeVisible();
    await expect(page.getByLabel("Forma de envio")).toHaveCount(0);
  });

  test("Funcionário de outro Setor não abre /rh", async ({ page }) => {
    await login(page, "funcionario.financeiro@rigonicontabil.local", "func123");
    await expect(page).toHaveURL("/");
    await page.goto("/rh");
    await expect(page).toHaveURL("/");
  });
});
