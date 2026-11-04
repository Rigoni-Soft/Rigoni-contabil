import { expect, test } from "./fixtures";
import { adminLocal } from "./support/admin-local";
import { cnpjUnico, login } from "./support/criar-cliente";

// Acompanhamento mensal do RH: o Funcionário marca os serviços dos seus clientes; o Líder lê todos
// (sem caixas habilitadas) e cadastra serviços; a marcação fica auditada.
const admin = adminLocal();
const EMPRESA = `Acomp E2E ${`${Date.now()}`.slice(-6)} Ltda`;
const FUNCIONARIO_RH_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const NOVO_SERVICO = `E2E ${`${Date.now()}`.slice(-5)}`;
let clienteId = "";
let cnpj = "";

test.describe("Acompanhamento mensal do RH", () => {
  test.beforeAll(async () => {
    clienteId = crypto.randomUUID();
    cnpj = cnpjUnico();
    const criado = await admin
      .from("clientes")
      .insert({ id: clienteId, empresa: EMPRESA, cnpj, regime: "lucro_presumido" });
    if (criado.error) throw criado.error;
    const resp = await admin
      .from("cliente_responsaveis")
      .insert({ cliente_id: clienteId, setor: "rh", responsavel_id: FUNCIONARIO_RH_ID });
    if (resp.error) throw resp.error;
  });

  test.afterAll(async () => {
    await admin.from("clientes").delete().eq("id", clienteId);
    await admin.from("rh_servicos_acompanhamento").delete().eq("nome", NOVO_SERVICO);
    await admin.from("registros_auditoria").delete().like("alvo", `${cnpj} %`);
  });

  test("Funcionário marca FGTS e a marcação fica auditada @smoke", async ({
    page,
  }) => {
    await login(page, "funcionario.rh@rigonicontabil.local", "func123");
    await expect(page).toHaveURL("/rh");
    await page.goto("/rh/acompanhamento");

    const fgts = page.getByLabel(`FGTS de ${EMPRESA}: concluído`);
    await expect(fgts).not.toBeChecked();
    await fgts.click();
    await expect(fgts).toBeChecked();
    await page.reload();
    await expect(page.getByLabel(`FGTS de ${EMPRESA}: concluído`)).toBeChecked();

    const { data } = await admin
      .from("registros_auditoria")
      .select("acao")
      .eq("acao", "rh.acompanhamento.marcar")
      .like("alvo", `${cnpj} FGTS %`);
    expect(data).toHaveLength(1);
  });

  test("Líder do RH lê a marcação do Funcionário sem poder alterá-la", async ({ page }) => {
    const { data: servico } = await admin
      .from("rh_servicos_acompanhamento")
      .select("id")
      .eq("nome", "NUTRI")
      .single();
    const competencia = `${new Date().toISOString().slice(0, 7)}-01`;
    await admin.from("rh_acompanhamento_marcacoes").upsert({
      cliente_id: clienteId,
      servico_id: servico!.id,
      competencia,
      marcado_por: FUNCIONARIO_RH_ID,
    });

    await login(page, "lider.rh@rigonicontabil.local", "lider123");
    await expect(page).toHaveURL("/rh");
    await page.goto("/rh/acompanhamento");

    const lido = page.getByLabel(`NUTRI de ${EMPRESA}: concluído`);
    await expect(lido).toBeChecked();
    await expect(lido).toBeDisabled();
  });

  test("Líder do RH cadastra um serviço e ele vira coluna", async ({ page }) => {
    await login(page, "lider.rh@rigonicontabil.local", "lider123");
    await expect(page).toHaveURL("/rh");
    await page.goto("/rh/acompanhamento");

    await page.getByLabel("Novo serviço").fill(NOVO_SERVICO);
    await page.getByRole("button", { name: "Cadastrar serviço" }).click();

    await expect(page.getByRole("columnheader", { name: NOVO_SERVICO })).toBeVisible();
  });
});
