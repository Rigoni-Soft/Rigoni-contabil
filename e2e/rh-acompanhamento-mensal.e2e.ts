import { expect, test } from "./fixtures";
import { adminLocal } from "./support/admin-local";
import { cnpjUnico, login } from "./support/criar-cliente";

// Acompanhamento mensal do RH: os serviços são cards no dashboard; o Funcionário marca os serviços dos seus
// clientes no painel do cliente; o Líder lê (sem caixas habilitadas) e cadastra serviços; a marcação fica auditada.
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

  test("Funcionário marca FGTS e a marcação fica auditada @smoke", async ({ page }) => {
    await login(page, "funcionario.rh@rigonicontabil.local", "func123");
    await expect(page).toHaveURL("/rh");
    await page.goto(`/clientes/${clienteId}`);

    const fgts = page.getByLabel("FGTS", { exact: true });
    await expect(fgts).toHaveValue("pendente");
    await fgts.selectOption("concluido");
    await expect(fgts).toHaveValue("concluido");
    await page.reload();
    await expect(page.getByLabel("FGTS", { exact: true })).toHaveValue("concluido");

    const { data } = await admin
      .from("registros_auditoria")
      .select("acao")
      .eq("acao", "rh.acompanhamento.marcar")
      .like("alvo", `${cnpj} FGTS %`);
    expect(data).toHaveLength(1);
  });

  test("Holerite se conclui sozinho com os cartões das duas quinzenas e reabre ao faltar um @smoke", async ({
    page,
  }) => {
    await login(page, "funcionario.rh@rigonicontabil.local", "func123");
    await expect(page).toHaveURL("/rh");
    const holerite = page.getByLabel("Holerite", { exact: true });

    // Sem empregados: não há Holerite a cumprir.
    await page.goto(`/clientes/${clienteId}`);
    await expect(holerite).toHaveValue("nao_aplica");
    await expect(
      page.getByText("Sem empregados cadastrados: não há Holerite a cumprir."),
    ).toBeVisible();

    // Um empregado com cartão só na 1ª quinzena: pendente; a 2ª quinzena o conclui.
    const mes = new Date().toISOString().slice(0, 7);
    const empregado = await admin
      .from("rh_empregados")
      .insert({
        cliente_id: clienteId,
        nome: "Ana Holerite",
        jornada: [0, 480, 480, 480, 480, 480, 0],
      })
      .select("id")
      .single();
    if (empregado.error) throw empregado.error;
    const batidas = [{ entrada: 480, saida: 1020 }];
    const dia = (n: number) => `${mes}-${String(n).padStart(2, "0")}`;
    await admin
      .from("rh_ponto_dias")
      .insert({ empregado_id: empregado.data.id, data: dia(3), batidas });

    await page.goto(`/clientes/${clienteId}`);
    await expect(holerite).toHaveValue("pendente");
    await expect(
      page.getByText("1 empregado cadastrado · 0 de 1 cartão feito no mês"),
    ).toBeVisible();
    await expect(holerite).toBeDisabled();

    await admin
      .from("rh_ponto_dias")
      .insert({ empregado_id: empregado.data.id, data: dia(20), batidas });
    await page.reload();
    await expect(holerite).toHaveValue("concluido");
    await expect(
      page.getByText("1 empregado cadastrado · 1 de 1 cartão feito no mês"),
    ).toBeVisible();

    // "Sem movimento no mês" tira o empregado da conta: sem cartão exigido, o Holerite deixa de valer.
    await admin.from("rh_ponto_dias").delete().eq("empregado_id", empregado.data.id);
    await admin
      .from("rh_empregado_sem_movimento")
      .insert({ empregado_id: empregado.data.id, competencia: `${mes}-01` });
    await page.reload();
    await expect(holerite).toHaveValue("nao_aplica");
  });

  test("Funcionário dispensa um serviço e ele deixa de contar como pendente (sai do card), com auditoria", async ({
    page,
  }) => {
    await login(page, "funcionario.rh@rigonicontabil.local", "func123");
    await expect(page).toHaveURL("/rh");
    await page.goto(`/clientes/${clienteId}`);

    const dctfweb = page.getByLabel("DCTFWeb", { exact: true });
    await expect(dctfweb).toHaveValue("pendente");
    await dctfweb.selectOption("nao_aplica");
    await expect(dctfweb).toHaveValue("nao_aplica");
    await page.reload();
    await expect(page.getByLabel("DCTFWeb", { exact: true })).toHaveValue("nao_aplica");

    const { data } = await admin
      .from("registros_auditoria")
      .select("acao")
      .eq("acao", "rh.acompanhamento.nao-aplicar")
      .like("alvo", `${cnpj} DCTFWeb %`);
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
    await page.goto(`/clientes/${clienteId}`);

    const lido = page.getByLabel("NUTRI", { exact: true });
    await expect(lido).toHaveValue("concluido");
    await expect(lido).toBeDisabled();
  });

  test("Líder do RH cadastra um serviço e ele vira card no dashboard", async ({ page }) => {
    await login(page, "lider.rh@rigonicontabil.local", "lider123");
    await expect(page).toHaveURL("/rh");
    await page.getByLabel("Configurações do Setor").click();
    await page.getByRole("link", { name: "Serviços do acompanhamento" }).click();

    await page.getByLabel("Novo serviço").fill(NOVO_SERVICO);
    await page.getByRole("button", { name: "Cadastrar serviço" }).click();
    await expect(page.getByText(NOVO_SERVICO)).toBeVisible();

    await page.goto("/rh");
    await expect(
      page.getByRole("link", { name: new RegExp(`${NOVO_SERVICO} pendente`) }),
    ).toBeVisible();
  });
});
