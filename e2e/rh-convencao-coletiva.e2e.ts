import { expect, test } from "./fixtures";
import { adminLocal } from "./support/admin-local";
import { cnpjUnico, login } from "./support/criar-cliente";

// Convenção coletiva do RH: o Líder sobe o PDF e vê as "Regras aplicadas" (extração com o modelo falso:
// cláusula, valor, diferença para a legislação e o que ficou "não aplicada"); renova e o histórico guarda a
// anterior; o Responsável só lê as regras e liga os interruptores do cliente; cada gravação fica auditada.
const admin = adminLocal();
const EMPRESA = `Convencao E2E ${`${Date.now()}`.slice(-6)} Ltda`;
const FUNCIONARIO_RH_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const SINDICATO = "Comércio E2E";
let clienteId = "";
let cnpj = "";

const pdf = (nome: string) => ({
  name: nome,
  mimeType: "application/pdf",
  buffer: Buffer.from(`%PDF-1.7 ${nome}`),
});

test.describe("Convenção coletiva do RH", () => {
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
    const arquivos = await admin.storage.from("convencoes-coletivas").list(clienteId);
    if (arquivos.data?.length) {
      await admin.storage
        .from("convencoes-coletivas")
        .remove(arquivos.data.map((a) => `${clienteId}/${a.name}`));
    }
    await admin.from("clientes").delete().eq("id", clienteId);
    await admin.from("registros_auditoria").delete().like("alvo", `${cnpj}%`);
  });

  test("Líder sobe a convenção e vê as Regras aplicadas, com o que ficou não aplicada @smoke", async ({
    page,
  }) => {
    await login(page, "lider.rh@rigonicontabil.local", "lider123");
    await expect(page).toHaveURL("/rh");
    await page.goto(`/rh/folha-de-ponto/${clienteId}/convencao`);
    await expect(page.getByText("Nenhuma convenção enviada para este cliente.")).toBeVisible();

    const form = page.getByRole("form", { name: "Enviar convenção" });
    await form.getByLabel("Sindicato").fill(SINDICATO);
    await form.getByLabel("Início da vigência").fill("2026-05-01");
    await form.getByLabel("Fim da vigência").fill("2027-04-30");
    await page.locator("#convencao-arquivo").setInputFiles(pdf("cct-2026.pdf"));
    await form.getByRole("button", { name: "Enviar convenção" }).click();

    await expect(page.getByRole("heading", { name: "Regras aplicadas" })).toBeVisible();
    const tabela = page.getByRole("region", { name: "Regras aplicadas da convenção" });
    const sabado = tabela.getByRole("row", { name: /Hora extra de sábado/ });
    await expect(sabado).toContainText("60%");
    await expect(sabado).toContainText("+10 pontos");
    await expect(sabado).toContainText("Cláusula 12ª");
    await expect(tabela.getByRole("row", { name: /Jornada semanal/ })).toContainText("44h");
    // O candidato sem o número no trecho foi recusado: vale a legislação.
    const intervalo = tabela.getByRole("row", { name: /Intervalo máximo/ });
    await expect(intervalo).toContainText("Não aplicada");
    await expect(intervalo).toContainText("Recusada: O número não aparece no trecho citado");
    await expect(tabela.getByRole("row", { name: /Exceções de feriado/ })).toContainText(
      "Não aplicada",
    );

    const gravou = await admin
      .from("registros_auditoria")
      .select("setor")
      .eq("acao", "rh.convencao.enviar")
      .like("alvo", `${cnpj} ${SINDICATO} 2026-05-01`);
    expect(gravou.data).toEqual([{ setor: "rh" }]);
  });

  test("renovar guarda a anterior no histórico, e leitura que falha não grava nada", async ({
    page,
  }) => {
    await login(page, "lider.rh@rigonicontabil.local", "lider123");
    await expect(page).toHaveURL("/rh");
    await page.goto(`/rh/folha-de-ponto/${clienteId}/convencao`);

    const form = page.getByRole("form", { name: "Enviar convenção" });
    await form.getByLabel("Sindicato").fill(SINDICATO);
    await form.getByLabel("Início da vigência").fill("2027-05-01");
    await form.getByLabel("Fim da vigência").fill("2028-04-30");
    await page.locator("#convencao-arquivo").setInputFiles({
      name: "cct-ilegivel.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.7 [extrator:falha]"),
    });
    await form.getByRole("button", { name: "Enviar convenção" }).click();
    await expect(page.getByText("Não foi possível ler a convenção.")).toBeVisible();
    const aposFalha = await admin.from("rh_convencoes").select("id").eq("cliente_id", clienteId);
    expect(aposFalha.data).toHaveLength(1);

    await page.locator("#convencao-arquivo").setInputFiles(pdf("cct-2027.pdf"));
    await form.getByRole("button", { name: "Enviar convenção" }).click();

    const historico = page.getByRole("region", { name: "Histórico de convenções" });
    await expect(historico.getByRole("link")).toHaveCount(2);
    await expect(historico.getByRole("link").first()).toContainText("01/05/2027 a 30/04/2028");
    await expect(historico.getByRole("link").first()).toHaveAttribute("aria-current", "true");
    await historico.getByRole("link", { name: /01\/05\/2026 a 30\/04\/2027/ }).click();
    await expect(page.getByText(`${SINDICATO} · 01/05/2026 a 30/04/2027`)).toBeVisible();
  });

  test("Funcionário Responsável lê as regras sem poder enviar e liga os interruptores", async ({
    page,
  }) => {
    await login(page, "funcionario.rh@rigonicontabil.local", "func123");
    await expect(page).toHaveURL("/rh");
    await page.goto(`/rh/folha-de-ponto/${clienteId}/convencao`);

    await expect(page.getByRole("heading", { name: "Regras aplicadas" })).toBeVisible();
    await expect(page.getByRole("form", { name: "Enviar convenção" })).toHaveCount(0);

    const banco = page.getByRole("checkbox", { name: "Banco de horas" });
    await expect(banco).not.toBeChecked();
    await banco.click();
    await expect(banco).toBeChecked();
    await page.reload();
    await expect(page.getByRole("checkbox", { name: "Banco de horas" })).toBeChecked();

    const audit = await admin
      .from("registros_auditoria")
      .select("acao")
      .eq("acao", "rh.cliente.interruptores")
      .like("alvo", `${cnpj} banco=sim domingos=nao`);
    expect(audit.data).toHaveLength(1);
  });
});
