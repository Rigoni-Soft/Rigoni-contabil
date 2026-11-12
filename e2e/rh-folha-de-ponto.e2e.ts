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

// Primeira segunda-feira do mês corrente.
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
    await page.goto(`/rh/folha-de-ponto/${clienteId}?mes=${mes}`);

    await page.getByRole("form", { name: "Novo empregado" }).getByLabel("Nome").fill("Ana E2E");
    await page.getByRole("button", { name: "Cadastrar empregado" }).click();
    // O cartão tem tela própria: a lista do quadro leva a ele.
    await page.getByRole("link", { name: "Cartão de ponto de Ana E2E" }).click();
    await expect(page.getByRole("heading", { name: "Ana E2E", exact: true })).toBeVisible();

    // Cartão novo: as linhas já abrem editáveis; o ✓ da linha salva.
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

  test("Salvar o cartão novo sem digitar nada o inicia e os dias úteis vazios viram falta", async ({
    page,
  }) => {
    const { mes } = primeiraSegunda();
    const empregado = await admin
      .from("rh_empregados")
      .insert({
        cliente_id: clienteId,
        nome: "Cris E2E",
        jornada: [0, 525, 525, 525, 525, 525, 240],
      })
      .select("id")
      .single();
    if (empregado.error) throw empregado.error;

    await login(page, "funcionario.rh@rigonicontabil.local", "func123");
    await expect(page).toHaveURL("/rh");
    await page.goto(`/rh/folha-de-ponto/${clienteId}/cartao/${empregado.data.id}?mes=${mes}`);

    // Cartão novo: nenhum dia é falta ainda.
    await expect(page.getByText("Falta", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Salvar", exact: true }).click();

    await expect(page.getByText(/A Totalização do mês foi atualizada/)).toBeVisible();
    await expect(page.getByText("Falta", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /^Abonar / }).first()).toBeVisible();
  });

  // Leitor falso (LEITURA_CARTAO_MODO padrão): a foto não é olhada e a leitura é sempre a do "Erick Falso".
  test("Funcionário sobe a foto do cartão e o empregado nasce no quadro com o cartão lido @smoke", async ({
    page,
  }) => {
    const { mes } = primeiraSegunda();
    await login(page, "funcionario.rh@rigonicontabil.local", "func123");
    await expect(page).toHaveURL("/rh");
    await page.goto(`/rh/folha-de-ponto/${clienteId}?mes=${mes}`);

    await page.getByLabel("Foto do cartão (JPEG ou PNG)").setInputFiles({
      name: "ponto-erick-quin-1.jpeg",
      mimeType: "image/jpeg",
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]),
    });
    await page.getByRole("button", { name: "Ler cartão" }).click();

    await expect(
      page.getByText(/Erick Falso \(cadastrado no quadro\): 3 dias lidos, 1 falta anotada/),
    ).toBeVisible();
    await page.getByRole("link", { name: "Cartão de ponto de Erick Falso" }).click();
    await expect(page.getByRole("heading", { name: "Erick Falso", exact: true })).toBeVisible();
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
    await page.goto(`/rh/folha-de-ponto/${clienteId}/cartao/${empregado.data.id}?mes=${mes}`);

    await expect(page.getByRole("heading", { name: "Bia E2E", exact: true })).toBeVisible();
    await expect(page.getByLabel(`Entrada 1 de ${rotulo}`)).toHaveAttribute("readonly", "");
    await expect(page.getByRole("button", { name: `Editar ${rotulo}` })).toHaveCount(0);
    await expect(page.getByRole("button", { name: `Salvar ${rotulo}` })).toHaveCount(0);
  });

  // Leitor falso: a foto do atestado não é olhada e a leitura é sempre a declaração de comparecimento do
  // "Erick Falso" em 01/09/2026 (ter), que abona só o horário de um dia que já tem batida.
  test("Funcionário lê a declaração e o dia com batida fica abonado @smoke", async ({ page }) => {
    const empregado = await admin
      .from("rh_empregados")
      .insert({
        cliente_id: clienteId,
        nome: "Erick Falso",
        jornada: [0, 525, 525, 525, 525, 525, 240],
      })
      .select("id")
      .single();
    if (empregado.error) throw empregado.error;
    const dia = await admin.from("rh_ponto_dias").insert({
      empregado_id: empregado.data.id,
      data: "2026-09-01",
      batidas: [{ entrada: 480, saida: 720 }],
    });
    if (dia.error) throw dia.error;

    await login(page, "funcionario.rh@rigonicontabil.local", "func123");
    await expect(page).toHaveURL("/rh");
    await page.goto(`/rh/folha-de-ponto/${clienteId}/cartao/${empregado.data.id}?mes=2026-09`);

    await page.getByRole("button", { name: "Ler atestado", exact: true }).click();
    await page.getByLabel("Foto do atestado (JPEG ou PNG)").setInputFiles({
      name: "declaracao-erick.jpeg",
      mimeType: "image/jpeg",
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]),
    });
    await page.getByRole("button", { name: "Abonar pelo atestado" }).click();

    await expect(
      page.getByText("1 dia abonado pela declaração de comparecimento. Confira o cartão."),
    ).toBeVisible();
    // O dia já tinha batida (4h de 8h45): a declaração abona só a diferença da carga, na Totalização.
    await expect(page.getByText("Abonos").locator("xpath=following-sibling::*[1]")).toHaveText(
      "0 dias · 4h45",
    );
  });
});
