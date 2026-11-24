import { expect, test } from "./fixtures";
import { adminLocal } from "./support/admin-local";
import { cnpjUnico, empresaUnica, login } from "./support/criar-cliente";

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

async function abrirCadastro(page: import("@playwright/test").Page, clienteId: string) {
  await page.goto(`/clientes/${clienteId}`);
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
}

test.describe("O que cada contato recebe do Setor", () => {
  test("SN edita os envios do contato de outro Setor e cadastra um contato com os envios @smoke", async ({
    page,
  }) => {
    const clienteId = await criarCliente(empresaUnica("Envios SN E2E"), "simples_nacional");
    await atribuir(clienteId, "simples_nacional", FUNCIONARIO_SN_ID);
    const paulo = await contatoDe(clienteId, "Paulo do RH", "paulo.rh@exemplo.com", "rh");

    await login(page, "funcionario.sn@rigonicontabil.local", "func123");
    await expect(page).toHaveURL("/simples-nacional");
    await abrirCadastro(page, clienteId);

    await expect(page.locator("[id='contatos.0.nome']")).toHaveCount(0);
    await page.locator("[id='contatos.1.nome']").selectOption({ label: "Paulo do RH" });
    const grupoPaulo = page.getByRole("group", { name: "Envios do contato 1" });
    await expect(page.locator("[id='contatos.0.nome']")).toHaveAttribute("readonly", "");
    await expect(page.getByRole("button", { name: "Remover contato 1" })).toHaveCount(0);
    await grupoPaulo.getByLabel("DAS").check();
    await expect(page.getByRole("button", { name: "Salvar", exact: true })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await page.getByRole("button", { name: "Salvar contato 1" }).click();
    await expect(page.getByRole("button", { name: "Editar contato 1" })).toBeVisible();
    expect(await destinosDe(clienteId)).toEqual([
      { setor: "simples_nacional", tipo: "das", canal: "email", contato_id: paulo },
    ]);

    await page.getByRole("button", { name: "Adicionar contato" }).click();
    await page.locator("[id='contatos.1.nome']").fill("Nina Exemplo");
    await page.locator("[id='contatos.1.telefone']").fill("11977776666");
    await page.locator("[id='contatos.1.email']").fill("nina@exemplo.com");
    const grupoNina = page.getByRole("group", { name: "Envios do contato 2" });
    await grupoNina.getByLabel("Todos os envios").check();
    for (const tipo of ["Lembrete de documento", "DAS", "Guia de parcelamento", "Avisos"]) {
      await expect(grupoNina.getByLabel(tipo)).toBeChecked();
    }
    await grupoNina.getByLabel("Avisos").uncheck();
    await expect(grupoNina.getByLabel("Todos os envios")).not.toBeChecked();
    const enviarPor = page.getByLabel("Enviar por");
    await expect(enviarPor).toHaveValue("");
    await page.getByRole("button", { name: "Salvar contato 2" }).click();
    await expect(page.getByText("Escolha por onde enviar a este contato.")).toBeVisible();
    expect(await destinosDe(clienteId)).toHaveLength(1);
    await enviarPor.selectOption("whatsapp_e_email");
    await page.getByRole("button", { name: "Salvar contato 2" }).click();
    await expect(page.getByRole("button", { name: "Editar contato 2" })).toBeVisible();
    await expect(page.getByText(/Enviar por:\s*WhatsApp e E-mail/)).toBeVisible();
    const daNina = async () => (await destinosDe(clienteId)).filter((d) => d.contato_id !== paulo);
    expect((await daNina()).map((d) => d.tipo)).toEqual([
      "das",
      "guia_parcelamento",
      "lembrete_documento",
    ]);
    expect((await daNina()).every((d) => d.canal === "whatsapp_e_email")).toBe(true);

    await page.getByRole("button", { name: "Adicionar contato" }).click();
    await page.locator("[id='contatos.2.telefone']").fill("11977776666");
    await page.locator("[id='contatos.2.telefone']").blur();
    await expect(
      page.getByText("Este número já é do contato Nina Exemplo, que já está na lista deste Setor."),
    ).toBeVisible();
    await page.getByRole("button", { name: "Cancelar edição do contato 3" }).click();
    await expect(page.locator("[id='contatos.2.telefone']")).toHaveCount(0);

    await page.getByRole("button", { name: "Editar contato 2" }).click();
    await grupoNina.getByLabel("Avisos").check();
    await page.getByRole("button", { name: "Cancelar edição do contato 2" }).click();
    await expect(grupoNina).toContainText("Lembrete de documento, DAS, Guia de parcelamento");
    await expect(grupoNina).not.toContainText("Avisos");
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(page).toHaveURL("/simples-nacional");
    expect(await daNina()).toHaveLength(3);
    const contatos = await admin
      .from("cliente_contatos")
      .select("nome")
      .eq("cliente_id", clienteId);
    expect(contatos.data?.map((c) => c.nome).sort()).toEqual(["Nina Exemplo", "Paulo do RH"]);

    await admin
      .from("cliente_contatos")
      .update({ email: null })
      .eq("nome", "Nina Exemplo")
      .eq("cliente_id", clienteId);
    await abrirCadastro(page, clienteId);
    await expect(page.getByText(/deixou de ter o e-mail/)).toBeVisible();

    await admin.from("clientes").delete().eq("id", clienteId);
  });

  test("RH marca só os tipos do RH, também no contato do SN", async ({ page }) => {
    const clienteId = await criarCliente(empresaUnica("Envios RH E2E"), "lucro_presumido");
    await atribuir(clienteId, "rh", FUNCIONARIO_RH_ID);
    await contatoDe(clienteId, "Sara do SN", "sara.sn@exemplo.com", "simples_nacional");

    await login(page, "funcionario.rh@rigonicontabil.local", "func123");
    await expect(page).toHaveURL("/rh");
    await abrirCadastro(page, clienteId);

    await page.locator("[id='contatos.1.nome']").selectOption({ label: "Sara do SN" });
    await expect(page.locator("[id='contatos.0.nome']")).toHaveAttribute("readonly", "");
    const grupo = page.getByRole("group", { name: "Envios do contato 1" });
    await expect(grupo.getByRole("checkbox")).toHaveCount(3);
    await expect(grupo.getByLabel("DAS")).toHaveCount(0);
    await grupo.getByLabel("Guia de parcelamento").check();
    await page.getByRole("button", { name: "Salvar contato 1" }).click();
    await expect(page.getByRole("button", { name: "Editar contato 1" })).toBeVisible();

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
    await page.getByRole("button", { name: "Editar contato 1" }).click();
    await expect(page.locator("[id='contatos.0.nome']")).not.toHaveAttribute("readonly", "");
    await page.locator("[id='contatos.0.nome']").fill("Lia Corrigida");
    await page.getByRole("button", { name: "Salvar contato 1" }).click();
    await expect(page.getByRole("button", { name: "Editar contato 1" })).toBeVisible();
    await page.getByRole("button", { name: "Adicionar contato" }).click();
    await page.locator("[id='contatos.1.nome']").fill("Beto do Admin");
    await page.locator("[id='contatos.1.email']").fill("beto@exemplo.com");
    await page.getByRole("button", { name: "Salvar contato 2" }).click();
    await expect(page.getByRole("button", { name: "Editar contato 2" })).toBeVisible();
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
