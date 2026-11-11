import { expect, test } from "./fixtures";
import { adminLocal } from "./support/admin-local";
import { cnpjUnico, login } from "./support/criar-cliente";

// Folha de ponto do RH: o Responsável cadastra o empregado no quadro do Cliente, digita o cartão e vê a
// Totalização pela legislação; o Líder lê sem poder alterar; cada gravação fica auditada.
const admin = adminLocal();
const EMPRESA = `Folha E2E ${`${Date.now()}`.slice(-6)} Ltda`;
const FUNCIONARIO_RH_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd";
let clienteId = "";
let cnpj = "";

// Primeira segunda-feira do mês corrente: sempre cai na 1ª quinzena.
function primeiraSegunda() {
  const mes = new Date().toISOString().slice(0, 7);
  const [ano, m] = mes.split("-").map(Number);
  const primeiro = new Date(Date.UTC(ano, m - 1, 1)).getUTCDay();
  const dia = 1 + ((8 - primeiro) % 7);
  const dd = String(dia).padStart(2, "0");
  return { mes, rotulo: `seg ${dd}/${String(m).padStart(2, "0")}` };
}

test.describe("Folha de ponto do RH", () => {
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
    await admin.from("registros_auditoria").delete().like("alvo", `${cnpj} %`);
  });

  test("Funcionário cadastra o empregado, digita o dia e vê a Totalização @smoke", async ({
    page,
  }) => {
    const { mes, rotulo } = primeiraSegunda();
    await login(page, "funcionario.rh@rigonicontabil.local", "func123");
    await expect(page).toHaveURL("/rh");
    await page.goto(`/rh/folha-de-ponto/${clienteId}?mes=${mes}&quinzena=1`);

    await page.getByRole("form", { name: "Novo empregado" }).getByLabel("Nome").fill("Ana E2E");
    await page.getByRole("button", { name: "Cadastrar empregado" }).click();
    await expect(page.getByRole("heading", { name: "Cartão de ponto de Ana E2E" })).toBeVisible();

    await page.getByLabel(`Entrada 1 de ${rotulo}`).fill("08:00");
    await page.getByLabel(`Saída 1 de ${rotulo}`).fill("12:00");
    await page.getByLabel(`Entrada 2 de ${rotulo}`).fill("13:00");
    await page.getByLabel(`Saída 2 de ${rotulo}`).fill("17:45");
    await page.getByRole("button", { name: `Salvar ${rotulo}` }).click();

    // A Totalização se recalcula na recarga: o dia cumprido soma 8h45 de horas normais.
    await expect(
      page.getByText("Horas normais").locator("xpath=following-sibling::*[1]"),
    ).toHaveText(/^8h45$/);
    await page.reload();
    await expect(page.getByLabel(`Entrada 1 de ${rotulo}`)).toHaveValue("08:00");

    const salvou = await admin
      .from("registros_auditoria")
      .select("acao")
      .eq("acao", "rh.ponto.salvar")
      .like("alvo", `${cnpj} Ana E2E %`);
    expect(salvou.data).toHaveLength(1);
    const cadastrou = await admin
      .from("registros_auditoria")
      .select("acao")
      .eq("acao", "rh.empregado.cadastrar")
      .like("alvo", `${cnpj} Ana E2E`);
    expect(cadastrou.data).toHaveLength(1);
  });

  test("Líder do RH lê o cartão sem poder alterá-lo", async ({ page }) => {
    const { mes, rotulo } = primeiraSegunda();
    const empregado = await admin
      .from("rh_empregados")
      .insert({
        cliente_id: clienteId,
        nome: "Bia E2E",
        jornada: [0, 525, 525, 525, 525, 525, 240],
      })
      .select("id")
      .single();
    if (empregado.error) throw empregado.error;

    await login(page, "lider.rh@rigonicontabil.local", "lider123");
    await expect(page).toHaveURL("/rh");
    await page.goto(
      `/rh/folha-de-ponto/${clienteId}?mes=${mes}&quinzena=1&empregado=${empregado.data.id}`,
    );

    await expect(page.getByRole("heading", { name: "Cartão de ponto de Bia E2E" })).toBeVisible();
    await expect(page.getByLabel(`Entrada 1 de ${rotulo}`)).toHaveAttribute("readonly", "");
    await expect(page.getByRole("button", { name: "Cadastrar empregado" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: `Salvar ${rotulo}` })).toHaveCount(0);
  });
});
