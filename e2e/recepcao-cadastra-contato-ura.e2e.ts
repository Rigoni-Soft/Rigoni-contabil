import { expect, test } from "./fixtures";
import { abrirConversaEmAtendimento } from "./support/abrir-conversa";
import { adminLocal } from "./support/admin-local";
import { login } from "./support/criar-cliente";

// A Recepção guarda como contato o número que a URA não achou: confirma o Cliente (o CNPJ da URA é só
// sugestão) e informa nome e e-mail. Os Atendimentos nascem direto no banco, já com a Recepção como dona.
const admin = adminLocal();

const RECEPCAO = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"; // funcionario.recepcao
const CLIENTE_A = crypto.randomUUID();
const CLIENTE_B = crypto.randomUUID();
const CNPJ_A = "29700003000110";
const CNPJ_B = "29700004000164";
const NOVO = "61955575001";
const DE_OUTRO_CLIENTE = "61955575002";
const JA_CONTATO = "61955575003";
const TELEFONES = [NOVO, DE_OUTRO_CLIENTE, JA_CONTATO];

async function atendimentoDaRecepcao(telefone: string, cnpjInformado?: string) {
  const { error } = await admin.from("atendimentos").insert({
    telefone: `55${telefone}`,
    chave_telefone: telefone,
    setor: "recepcao",
    funcionario_id: RECEPCAO,
    assumido_em: new Date().toISOString(),
    cnpj_informado: cnpjInformado ?? null,
  });
  if (error) throw error;
}

async function contatosDe(clienteId: string) {
  const { data, error } = await admin
    .from("cliente_contatos")
    .select("nome, telefone, email, dono_setor")
    .eq("cliente_id", clienteId);
  if (error) throw error;
  return data;
}

async function limpar() {
  await admin.from("atendimentos").delete().in("chave_telefone", TELEFONES);
  await admin.from("registros_auditoria").delete().in("alvo", [CNPJ_A, CNPJ_B]);
  await admin.from("clientes").delete().in("id", [CLIENTE_A, CLIENTE_B]);
}

test.describe("Recepção cadastra contato URA", () => {
  test.beforeAll(async () => {
    await limpar();
    // Sobra de Atendimentos da Recepção de outras execuções desloca a lista da aba.
    await admin.from("atendimentos").delete().eq("funcionario_id", RECEPCAO);
    for (const [id, empresa, cnpj] of [
      [CLIENTE_A, "Padaria Contato Ura Ltda", CNPJ_A],
      [CLIENTE_B, "Mercado Outro Cliente Ltda", CNPJ_B],
    ]) {
      const { error } = await admin
        .from("clientes")
        .insert({ id, empresa, cnpj, regime: "simples_nacional" });
      if (error) throw error;
    }
    const contatos = await admin.from("cliente_contatos").insert([
      {
        id: crypto.randomUUID(),
        cliente_id: CLIENTE_B,
        nome: "Carlos do Mercado",
        telefone: DE_OUTRO_CLIENTE,
      },
      { id: crypto.randomUUID(), cliente_id: CLIENTE_A, nome: "Joana", telefone: JA_CONTATO },
    ]);
    if (contatos.error) throw contatos.error;
    await atendimentoDaRecepcao(NOVO, CNPJ_A);
    await atendimentoDaRecepcao(DE_OUTRO_CLIENTE);
    await atendimentoDaRecepcao(JA_CONTATO);
  });

  test.afterAll(limpar);

  test("confirma o Cliente sugerido pela URA e cadastra o contato com setor URA e a Recepção dona @smoke", async ({
    page,
  }) => {
    await login(page, "funcionario.recepcao@rigonicontabil.local", "func123");
    await expect(page).toHaveURL("/");
    await abrirConversaEmAtendimento(page, /95557-5001/);

    await page.getByRole("button", { name: "Cadastrar como contato deste Cliente" }).click();
    // O CNPJ que o número informou na URA vem como sugestão, e o foco vai ao campo.
    const cnpj = page.getByLabel(/CNPJ do Cliente/);
    await expect(cnpj).toHaveValue("29.700.003/0001-10");
    await expect(cnpj).toBeFocused();
    await page.getByRole("button", { name: "Buscar Cliente" }).click();

    await expect(page.getByText(/Cliente: Padaria Contato Ura Ltda/)).toBeVisible();
    await expect(page.getByLabel(/^Nome/)).toBeFocused();
    await expect(page.getByText(/95557-5001/).last()).toBeVisible();
    await page.getByLabel(/^Nome/).fill("Maria da Padaria");
    await page.getByLabel(/E-mail/).fill("maria@padaria-ura.teste");
    await page.getByRole("button", { name: "Cadastrar contato" }).click();

    await expect(
      page.getByText("Maria da Padaria cadastrado como contato de Padaria Contato Ura Ltda."),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Cadastrar como contato deste Cliente" }),
    ).toHaveCount(0);

    expect(await contatosDe(CLIENTE_A)).toContainEqual({
      nome: "Maria da Padaria",
      telefone: NOVO,
      email: "maria@padaria-ura.teste",
      dono_setor: "recepcao",
    });
    const auditoria = await admin
      .from("registros_auditoria")
      .select("acao")
      .eq("alvo", CNPJ_A)
      .eq("acao", "contato.cadastrar-ura");
    expect(auditoria.data).toHaveLength(1);
  });

  test("número que já é contato de outro Cliente não cadastra e deixa trocar o Cliente", async ({
    page,
  }) => {
    await login(page, "funcionario.recepcao@rigonicontabil.local", "func123");
    await expect(page).toHaveURL("/");
    await abrirConversaEmAtendimento(page, /95557-5002/);

    await page.getByRole("button", { name: "Cadastrar como contato deste Cliente" }).click();
    await page.getByLabel(/CNPJ do Cliente/).fill(CNPJ_A);
    await page.getByRole("button", { name: "Buscar Cliente" }).click();
    await page.getByLabel(/^Nome/).fill("Alguém");
    await page.getByRole("button", { name: "Cadastrar contato" }).click();

    await expect(page.getByText(/já é contato de outro Cliente/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Trocar Cliente" })).toBeVisible();
    expect(await contatosDe(CLIENTE_A)).not.toContainEqual(
      expect.objectContaining({ telefone: DE_OUTRO_CLIENTE }),
    );
  });

  test("número que já é contato do mesmo Cliente mostra o existente sem duplicar", async ({
    page,
  }) => {
    await login(page, "funcionario.recepcao@rigonicontabil.local", "func123");
    await expect(page).toHaveURL("/");
    await abrirConversaEmAtendimento(page, /95557-5003/);

    await page.getByRole("button", { name: "Cadastrar como contato deste Cliente" }).click();
    await page.getByLabel(/CNPJ do Cliente/).fill(CNPJ_A);
    await page.getByRole("button", { name: "Buscar Cliente" }).click();
    await page.getByLabel(/^Nome/).fill("Outro Nome");
    await page.getByRole("button", { name: "Cadastrar contato" }).click();

    await expect(page.getByText(/já é o contato Joana de Padaria Contato Ura Ltda/)).toBeVisible();
    const joanas = (await contatosDe(CLIENTE_A)).filter((c) => c.telefone === JA_CONTATO);
    expect(joanas).toHaveLength(1);
  });

  test("CNPJ sem Cliente mostra o erro e fica na busca", async ({ page }) => {
    await login(page, "funcionario.recepcao@rigonicontabil.local", "func123");
    await expect(page).toHaveURL("/");
    await abrirConversaEmAtendimento(page, /95557-5003/);

    await page.getByRole("button", { name: "Cadastrar como contato deste Cliente" }).click();
    await page.getByLabel(/CNPJ do Cliente/).fill("29700009000197");
    await page.getByRole("button", { name: "Buscar Cliente" }).click();

    await expect(page.getByText("Nenhum Cliente com este CNPJ.")).toBeVisible();
    await expect(page.getByLabel(/CNPJ do Cliente/)).toBeVisible();

    // CNPJ com dígito errado nem chega à consulta.
    await page.getByLabel(/CNPJ do Cliente/).fill("29700009000100");
    await page.getByRole("button", { name: "Buscar Cliente" }).click();
    await expect(page.getByText("Informe um CNPJ válido.")).toBeVisible();
  });
});
