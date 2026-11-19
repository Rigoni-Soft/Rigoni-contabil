import { expect, test } from "./fixtures";
import { adminLocal } from "./support/admin-local";
import { cnpjUnico, empresaUnica, login } from "./support/criar-cliente";

// O que cada contato recebe do Setor (checkboxes na linha do contato), no cadastro do SN, do RH e do
// Admin; o contato de outro Setor fica só de leitura. Dados fictícios.
const admin = adminLocal();
const FUNCIONARIO_SN_ID = "22222222-2222-2222-2222-222222222222";
const FUNCIONARIO_RH_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd";

async function criarCliente(empresa: string, regime: "simples_nacional" | "lucro_presumido") {
  const id = crypto.randomUUID();
  const criado = await admin.from("clientes").insert({ id, empresa, cnpj: cnpjUnico(), regime });
  if (criado.error) throw criado.error;
  return id;
}

async function atribuir(clienteId: string, setor: string, responsavelId: string) {
  const { error } = await admin
    .from("cliente_responsaveis")
    .insert({ cliente_id: clienteId, setor, responsavel_id: responsavelId });
  if (error) throw error;
}

async function contatoDe(clienteId: string, nome: string, email: string, dono: string) {
  const { data, error } = await admin
    .from("cliente_contatos")
    .insert({ id: crypto.randomUUID(), cliente_id: clienteId, nome, email, dono_setor: dono })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

const destinosDe = async (clienteId: string) => {
  const { data } = await admin
    .from("destinos_de_envio")
    .select("setor, tipo, canal, contato_id")
    .eq("cliente_id", clienteId)
    .order("tipo", { nullsFirst: true });
  return data ?? [];
};

// Espera a hidratação: preencher antes dela deixa o React Hook Form reaplicar os valores iniciais.
async function abrirCadastro(page: import("@playwright/test").Page, clienteId: string) {
  await page.goto(`/clientes/${clienteId}`);
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
}

test.describe("O que cada contato recebe do Setor", () => {
  test("SN marca os envios do contato de outro Setor e do contato que cadastra; o do RH fica em leitura @smoke", async ({
    page,
  }) => {
    const clienteId = await criarCliente(empresaUnica("Envios SN E2E"), "simples_nacional");
    await atribuir(clienteId, "simples_nacional", FUNCIONARIO_SN_ID);
    const paulo = await contatoDe(clienteId, "Paulo do RH", "paulo.rh@exemplo.com", "rh");

    await login(page, "funcionario.sn@rigonicontabil.local", "func123");
    await expect(page).toHaveURL("/simples-nacional");
    await abrirCadastro(page, clienteId);

    // Contato de outro Setor: campos só de leitura, mas o Setor marca o que ele recebe.
    await expect(page.locator("[id='contatos.0.nome']")).toHaveAttribute("readonly", "");
    const grupoPaulo = page.getByRole("group", { name: "Envios do contato 1" });
    await expect(grupoPaulo.getByLabel("Avisos")).not.toBeChecked();
    await grupoPaulo.getByLabel("DAS").check();
    await expect(page.getByText("DAS marcado no contato 1.")).toBeAttached();
    expect(await destinosDe(clienteId)).toEqual([
      { setor: "simples_nacional", tipo: "das", canal: "email", contato_id: paulo },
    ]);

    // Contato novo do Setor: os checkboxes esperam o "Salvar contato" da linha.
    await page.getByRole("button", { name: "Adicionar contato" }).click();
    await page.locator("[id='contatos.1.nome']").fill("Nina Exemplo");
    await page.locator("[id='contatos.1.telefone']").fill("11977776666");
    await page.locator("[id='contatos.1.email']").fill("nina@exemplo.com");
    const grupoNina = page.getByRole("group", { name: "Envios do contato 2" });
    await expect(grupoNina.getByLabel("Avisos")).toBeDisabled();
    await expect(grupoNina.getByText("Salve o contato para escolher os envios.")).toBeVisible();
    await page.getByRole("button", { name: "Salvar contato 2" }).click();
    await expect(page.getByRole("button", { name: "Remover contato 2" })).toBeVisible();

    // Os dois canais: o canal do envio é "WhatsApp e e-mail", derivado do contato.
    await expect(grupoNina.getByLabel("Avisos")).toBeEnabled();
    // "Todos os envios" marca todos os outros; desmarcar um deles desmarca o "Todos".
    await grupoNina.getByLabel("Todos os envios").check();
    for (const tipo of ["Lembrete de documento", "DAS", "Guia de parcelamento", "Avisos"]) {
      await expect(grupoNina.getByLabel(tipo)).toBeChecked();
    }
    const daNina = async () =>
      (await destinosDe(clienteId)).filter((d) => d.contato_id !== paulo).map((d) => d.tipo);
    await expect
      .poll(daNina)
      .toEqual([null, "avisos", "das", "guia_parcelamento", "lembrete_documento"]);

    await grupoNina.getByLabel("Avisos").uncheck();
    await expect(grupoNina.getByLabel("Todos os envios")).not.toBeChecked();
    await expect(grupoNina.getByLabel("DAS")).toBeChecked();
    await expect.poll(daNina).toEqual(["das", "guia_parcelamento", "lembrete_documento"]);

    // Marcar o que faltava marca o "Todos" de volta; o Salvar do cadastro não apaga contato nem envios.
    await grupoNina.getByLabel("Avisos").check();
    await expect(grupoNina.getByLabel("Todos os envios")).toBeChecked();
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(page).toHaveURL("/simples-nacional");
    expect(await daNina()).toHaveLength(5);
    const contatos = await admin
      .from("cliente_contatos")
      .select("nome")
      .eq("cliente_id", clienteId);
    expect(contatos.data?.map((c) => c.nome).sort()).toEqual(["Nina Exemplo", "Paulo do RH"]);

    // Contato que perde o canal que o envio usa: o aviso aparece na linha.
    await admin
      .from("cliente_contatos")
      .update({ email: null })
      .eq("nome", "Nina Exemplo")
      .eq("cliente_id", clienteId);
    await abrirCadastro(page, clienteId);
    await expect(page.getByText(/deixou de ter o e-mail/)).toBeVisible();

    await admin.from("clientes").delete().eq("id", clienteId);
  });

  test("RH marca só os tipos do RH e vê o contato do SN em leitura", async ({ page }) => {
    const clienteId = await criarCliente(empresaUnica("Envios RH E2E"), "lucro_presumido");
    await atribuir(clienteId, "rh", FUNCIONARIO_RH_ID);
    await contatoDe(clienteId, "Sara do SN", "sara.sn@exemplo.com", "simples_nacional");

    await login(page, "funcionario.rh@rigonicontabil.local", "func123");
    await expect(page).toHaveURL("/rh");
    await abrirCadastro(page, clienteId);

    await expect(page.locator("[id='contatos.0.nome']")).toHaveAttribute("readonly", "");
    const grupo = page.getByRole("group", { name: "Envios do contato 1" });
    await expect(grupo.getByRole("checkbox")).toHaveCount(3);
    await expect(grupo.getByLabel("DAS")).toHaveCount(0);
    await grupo.getByLabel("Guia de parcelamento").check();
    await expect(page.getByText("Guia de parcelamento marcado no contato 1.")).toBeAttached();

    expect(await destinosDe(clienteId)).toEqual([
      { setor: "rh", tipo: "guia_parcelamento", canal: "email", contato_id: expect.any(String) },
    ]);

    await admin.from("clientes").delete().eq("id", clienteId);
  });

  test("Admin edita qualquer contato e cadastra contato, sem checkboxes de envio", async ({
    page,
  }) => {
    const clienteId = await criarCliente(empresaUnica("Envios Admin E2E"), "simples_nacional");
    await contatoDe(clienteId, "Lia do RH", "lia.rh@exemplo.com", "rh");

    await login(page, "admin@rigonicontabil.local", "admin123");
    await expect(page).toHaveURL("/");
    await abrirCadastro(page, clienteId);

    await expect(page.getByRole("group", { name: /Envios do contato/ })).toHaveCount(0);
    await expect(page.locator("[id='contatos.0.nome']")).not.toHaveAttribute("readonly", "");
    await page.locator("[id='contatos.0.nome']").fill("Lia Corrigida");
    await page.getByRole("button", { name: "Adicionar contato" }).click();
    await page.locator("[id='contatos.1.nome']").fill("Beto do Admin");
    await page.locator("[id='contatos.1.email']").fill("beto@exemplo.com");
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(page).toHaveURL("/");

    const contatos = await admin
      .from("cliente_contatos")
      .select("nome, dono_setor")
      .eq("cliente_id", clienteId)
      .order("nome");
    expect(contatos.data).toEqual([
      { nome: "Beto do Admin", dono_setor: null },
      { nome: "Lia Corrigida", dono_setor: "rh" },
    ]);

    await admin.from("clientes").delete().eq("id", clienteId);
  });
});
