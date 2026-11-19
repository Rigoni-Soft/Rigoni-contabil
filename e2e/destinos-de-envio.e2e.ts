import { expect, test } from "./fixtures";
import { adminLocal } from "./support/admin-local";
import { cnpjUnico, empresaUnica, login } from "./support/criar-cliente";

// Contatos e Destinos de envio por Setor no cadastro do Cliente: o SN e o RH escolhem ou cadastram o
// contato e definem tipo e forma de envio; o contato de outro Setor aparece só em leitura; o Admin só
// cadastra e edita contatos. Dados fictícios.
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

async function contatoDeOutroSetor(clienteId: string, nome: string, email: string, dono: string) {
  const { data, error } = await admin
    .from("cliente_contatos")
    .insert({ id: crypto.randomUUID(), cliente_id: clienteId, nome, email, dono_setor: dono })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

// Espera a hidratação: preencher antes dela deixa o React Hook Form reaplicar os valores iniciais.
async function abrirCadastro(page: import("@playwright/test").Page, clienteId: string) {
  await page.goto(`/clientes/${clienteId}`);
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
}

test.describe("Contatos e destinos de envio por Setor", () => {
  test("SN escolhe contato de outro Setor, cadastra um novo e remove destino; o contato do RH fica em leitura @smoke", async ({
    page,
  }) => {
    const clienteId = await criarCliente(empresaUnica("Destinos SN E2E"), "simples_nacional");
    await atribuir(clienteId, "simples_nacional", FUNCIONARIO_SN_ID);
    const paulo = await contatoDeOutroSetor(clienteId, "Paulo do RH", "paulo.rh@exemplo.com", "rh");

    await login(page, "funcionario.sn@rigonicontabil.local", "func123");
    await expect(page).toHaveURL("/simples-nacional");
    await abrirCadastro(page, clienteId);

    // O contato do RH aparece só em leitura, e o Setor não tem botão de adicionar contato solto.
    await expect(page.getByText(/Contato do RH: só o RH e o Admin editam/)).toBeVisible();
    await expect(page.locator("[id='contatos.0.nome']")).toHaveAttribute("readonly", "");
    await expect(page.getByRole("button", { name: "Adicionar contato" })).toBeHidden();
    await expect(page.getByText(/ainda não tem destino de envio/)).toBeVisible();

    // Contato de outro Setor como destino: nome e e-mail se preenchem; canal único já vem escolhido.
    await page.locator("#destino-contato").selectOption({ label: "paulo.rh@exemplo.com" });
    await expect(page.locator("#destino-nome-do-contato")).toHaveValue("Paulo do RH");
    await expect(page.locator("#destino-canal")).toHaveValue("E-mail");
    await page.locator("#destino-tipo").selectOption({ label: "DAS" });
    await page.getByRole("button", { name: "Adicionar destino" }).click();
    await expect(page.getByText(/Paulo do RH · paulo.rh@exemplo.com · E-mail/)).toBeVisible();
    await expect(page.getByText("Destino adicionado.")).toBeAttached();
    await expect(page.locator("#destino-contato")).toBeFocused();

    const gravado = await admin
      .from("destinos_de_envio")
      .select("setor, tipo, contato_id, canal")
      .eq("cliente_id", clienteId);
    expect(gravado.data).toEqual([
      { setor: "simples_nacional", tipo: "das", contato_id: paulo, canal: "email" },
    ]);

    // Contato novo com os dois canais: pede a forma de envio, sem padrão.
    await page.getByRole("button", { name: "Novo contato" }).click();
    await page.locator("#destino-nome").fill("Nina Exemplo");
    await page.locator("#destino-telefone").fill("11977776666");
    await page.locator("#destino-email").fill("nina@exemplo.com");
    await expect(page.locator("#destino-canal")).toHaveValue("");
    await page.getByRole("button", { name: "Adicionar destino" }).click();
    await expect(page.getByText("Escolha a forma de envio.")).toBeVisible();
    await page.locator("#destino-canal").selectOption({ label: "WhatsApp e E-mail" });
    await page.getByRole("button", { name: "Adicionar destino" }).click();
    await expect(
      page.getByText(/Nina Exemplo · \(11\) 97777-6666 · WhatsApp e E-mail/),
    ).toBeVisible();

    // Número que já é do Cliente: mostra o contato existente em vez de criar o repetido.
    await page.getByRole("button", { name: "Novo contato" }).click();
    await page.locator("#destino-nome").fill("Outra Nina");
    await page.locator("#destino-telefone").fill("11977776666");
    await expect(
      page.getByText(/já tem um contato com esse WhatsApp ou e-mail: Nina Exemplo/),
    ).toBeVisible();
    await page.getByRole("button", { name: "Usar este contato" }).click();
    await expect(page.locator("#destino-nome-do-contato")).toHaveValue("Nina Exemplo");

    // Remover o destino do contato do RH; o contato continua, e o Salvar do cadastro não o apaga.
    await page.getByRole("button", { name: "Remover destino DAS de Paulo do RH" }).click();
    await expect(page.getByText("Destino removido.")).toBeAttached();
    await expect(page.getByText(/Paulo do RH · paulo.rh@exemplo.com/)).toBeHidden();
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(page).toHaveURL("/simples-nacional");
    const contatos = await admin
      .from("cliente_contatos")
      .select("nome")
      .eq("cliente_id", clienteId);
    expect(contatos.data?.map((c) => c.nome).sort()).toEqual(["Nina Exemplo", "Paulo do RH"]);

    await admin.from("clientes").delete().eq("id", clienteId);
  });

  test("RH define destinos separados por tipo e vê o contato do SN só em leitura", async ({
    page,
  }) => {
    const clienteId = await criarCliente(empresaUnica("Destinos RH E2E"), "lucro_presumido");
    await atribuir(clienteId, "rh", FUNCIONARIO_RH_ID);
    await contatoDeOutroSetor(clienteId, "Sara do SN", "sara.sn@exemplo.com", "simples_nacional");

    await login(page, "funcionario.rh@rigonicontabil.local", "func123");
    await expect(page).toHaveURL("/rh");
    await abrirCadastro(page, clienteId);

    await expect(
      page.getByText(/Contato do Simples Nacional: só o Simples Nacional e o Admin editam/),
    ).toBeVisible();
    // O catálogo do RH: guia de parcelamento e avisos (sem os tipos do SN).
    const tipos = page.locator("#destino-tipo");
    await expect(tipos.getByRole("option")).toHaveText([
      "Todos os envios do Setor",
      "Guia de parcelamento",
      "Avisos",
    ]);

    await page.getByRole("button", { name: "Novo contato" }).click();
    await page.locator("#destino-nome").fill("Rita Financeira");
    await page.locator("#destino-telefone").fill("11966665555");
    await tipos.selectOption({ label: "Guia de parcelamento" });
    await page.getByRole("button", { name: "Adicionar destino" }).click();
    await expect(
      page
        .getByRole("listitem")
        .filter({ hasText: "Rita Financeira · (11) 96666-5555 · WhatsApp" }),
    ).toContainText("Guia de parcelamento");

    await page.locator("#destino-contato").selectOption({ label: "sara.sn@exemplo.com" });
    await tipos.selectOption({ label: "Avisos" });
    await page.getByRole("button", { name: "Adicionar destino" }).click();
    await expect(page.getByText(/Sara do SN · sara.sn@exemplo.com · E-mail/)).toBeVisible();

    const gravados = await admin
      .from("destinos_de_envio")
      .select("setor, tipo")
      .eq("cliente_id", clienteId)
      .order("tipo");
    expect(gravados.data).toEqual([
      { setor: "rh", tipo: "avisos" },
      { setor: "rh", tipo: "guia_parcelamento" },
    ]);

    await admin.from("clientes").delete().eq("id", clienteId);
  });

  test("Admin edita qualquer contato e cadastra contato, sem definir destinos", async ({
    page,
  }) => {
    const clienteId = await criarCliente(empresaUnica("Destinos Admin E2E"), "simples_nacional");
    await contatoDeOutroSetor(clienteId, "Lia do RH", "lia.rh@exemplo.com", "rh");

    await login(page, "admin@rigonicontabil.local", "admin123");
    await expect(page).toHaveURL("/");
    await abrirCadastro(page, clienteId);

    await expect(page.getByText("Destinos de envio")).toHaveCount(0);
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
