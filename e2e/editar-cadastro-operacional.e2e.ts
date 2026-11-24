import { createClient } from "@supabase/supabase-js";

import { expect, test } from "./fixtures";
import { adminLocal } from "./support/admin-local";
import {
  atribuirResponsavelComoLider,
  criarClienteComoAdmin,
  login,
} from "./support/criar-cliente";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

async function logout(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/login$/);
}
async function buscarClienteIdPorCnpj(cnpjDigits: string): Promise<string> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { error: erroLogin } = await supabase.auth.signInWithPassword({
    email: "admin@rigonicontabil.local",
    password: "admin123",
  });
  if (erroLogin) throw new Error(`Falha ao autenticar Admin: ${erroLogin.message}`);

  const { data, error } = await supabase
    .from("clientes")
    .select("id")
    .eq("cnpj", cnpjDigits)
    .single();
  if (error || !data)
    throw new Error(`Cliente não encontrado (CNPJ ${cnpjDigits}): ${error?.message}`);
  return data.id as string;
}

async function tornarFinanceiroResponsavel(clienteId: string) {
  const { error } = await adminLocal().from("cliente_responsaveis").insert({
    cliente_id: clienteId,
    setor: "financeiro",
    responsavel_id: "33333333-3333-3333-3333-333333333333",
  });
  if (error) throw new Error(`Falha ao atribuir Responsável no Financeiro: ${error.message}`);
}

test.describe("Editar cadastro operacional do Cliente (#34)", () => {
  test("Funcionário SN edita o cadastro operacional, salvar fecha a tela e a alteração persiste", async ({
    page,
  }) => {
    const cnpjDigits = await criarClienteComoAdmin(page, "Cadastro Operacional E2E Ltda");
    const clienteId = await buscarClienteIdPorCnpj(cnpjDigits);
    await atribuirResponsavelComoLider(cnpjDigits);

    await logout(page);
    await login(page, "funcionario.sn@rigonicontabil.local", "func123");
    await expect(page).toHaveURL("/simples-nacional");
    await page.goto(`/clientes/${clienteId}`);

    await expect(page.getByRole("heading", { name: "Editar cadastro operacional" })).toBeVisible();
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);

    await expect(page.locator("#formaEnvio")).toHaveCount(0);
    await page.getByLabel("Nome").fill("Maria Contato");
    await page.getByLabel("WhatsApp").fill("11999998888");
    await page.getByLabel("E-mail", { exact: true }).fill("maria.contato@exemplo.com");
    await page.getByRole("button", { name: "Salvar contato 1" }).click();
    await expect(page.getByRole("button", { name: "Remover contato 1" })).toBeVisible();
    await page.getByLabel("Documento recebido").selectOption("positivo");
    await expect(page.locator("#dasStatus").getByRole("option", { name: "Enviado" })).toHaveCount(
      0,
    );
    await expect(page.getByLabel("Data de envio")).toHaveAttribute("readonly", "");
    await expect(page.getByLabel("Data de envio")).toBeDisabled();
    await page.locator("#dasStatus").selectOption("pronto");
    await page.getByRole("checkbox", { name: "Comércio" }).check();
    await page.getByLabel("Observações gerais").fill("Observação de teste E2E.");

    await page.getByRole("button", { name: "Salvar", exact: true }).click();

    await expect(page).toHaveURL("/simples-nacional");

    await page.goto(`/clientes/${clienteId}`);

    await expect(page.getByLabel("Nome")).toHaveValue("Maria Contato");
    await expect(page.getByLabel("WhatsApp")).toHaveValue("(11) 99999-8888");
    await expect(page.getByLabel("E-mail", { exact: true })).toHaveValue(
      "maria.contato@exemplo.com",
    );
    await expect(page.getByLabel("Documento recebido")).toHaveValue("positivo");
    await expect(page.locator("#dasStatus")).toHaveValue("pronto");
    await expect(page.getByRole("checkbox", { name: "Comércio" })).toBeChecked();
    await expect(page.getByLabel("Observações gerais")).toHaveValue("Observação de teste E2E.");
  });

  test("contato por linha: Salvar mantém o id, Limpar zera a linha nova e o contato em uso por outro Setor passa à URA @smoke", async ({
    page,
  }) => {
    const cnpjDigits = await criarClienteComoAdmin(page, "Contato Por Linha E2E Ltda");
    const clienteId = await buscarClienteIdPorCnpj(cnpjDigits);
    await atribuirResponsavelComoLider(cnpjDigits);
    await logout(page);
    await login(page, "funcionario.sn@rigonicontabil.local", "func123");
    await expect(page).toHaveURL("/simples-nacional");
    await page.goto(`/clientes/${clienteId}`);
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);

    await page.locator("[id='contatos.0.nome']").fill("Ana Linha");
    await page.locator("[id='contatos.0.telefone']").fill("11988887777");
    await page.getByRole("button", { name: "Salvar contato 1" }).click();
    await expect(page.getByRole("button", { name: "Remover contato 1" })).toBeVisible();
    await expect(page.getByText("Contato 1 salvo.")).toBeAttached();
    await expect(page.locator("[id='contatos.0.editar']")).toBeFocused();

    const admin = adminLocal();
    const gravado = await admin
      .from("cliente_contatos")
      .select("id, nome")
      .eq("cliente_id", clienteId)
      .single();
    expect(gravado.data?.nome).toBe("Ana Linha");

    await page.reload();
    await expect(page.locator("[id='contatos.0.nome']")).toHaveValue("Ana Linha");
    const depois = await admin.from("cliente_contatos").select("id").eq("cliente_id", clienteId);
    expect(depois.data).toEqual([{ id: gravado.data?.id }]);

    await page.getByRole("button", { name: "Adicionar contato" }).click();
    await page.locator("[id='contatos.1.nome']").fill("Rascunho");
    await page.getByRole("button", { name: "Cancelar edição do contato 2" }).click();
    await expect(page.locator("[id='contatos.1.nome']")).toHaveCount(0);
    await expect(page.locator("[id='contatos.0.nome']")).toHaveValue("Ana Linha");

    const uso = await admin.from("destinos_de_envio").insert({
      cliente_id: clienteId,
      setor: "rh",
      contato_id: gravado.data?.id,
      canal: "whatsapp",
    });
    expect(uso.error).toBeNull();
    await page.getByRole("button", { name: "Remover contato 1" }).click();
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(page).toHaveURL("/simples-nacional");
    const aindaLa = await admin
      .from("cliente_contatos")
      .select("id, dono_setor")
      .eq("cliente_id", clienteId);
    expect(aindaLa.data).toEqual([{ id: gravado.data?.id, dono_setor: null }]);
  });

  test("DAS já enviado pelo sistema: DAS e data ficam desativados e o salvar preserva os dois", async ({
    page,
  }) => {
    const cnpjDigits = await criarClienteComoAdmin(page, "Cadastro DAS Enviado E2E Ltda");
    const clienteId = await buscarClienteIdPorCnpj(cnpjDigits);
    await atribuirResponsavelComoLider(cnpjDigits);
    const { error } = await adminLocal()
      .from("cliente_cadastro_operacional_sn")
      .update({ das_status: "enviado", data_envio_das: "2026-10-05" })
      .eq("cliente_id", clienteId);
    if (error) throw new Error(`Falha ao simular o envio do DAS: ${error.message}`);

    await logout(page);
    await login(page, "funcionario.sn@rigonicontabil.local", "func123");
    await expect(page).toHaveURL("/simples-nacional");
    await page.goto(`/clientes/${clienteId}`);

    await expect(page.locator("#dasStatus")).toHaveValue("enviado");
    await expect(page.locator("#dasStatus")).toBeDisabled();
    await expect(page.getByLabel("Data de envio")).toHaveValue("2026-10-05");
    await expect(page.getByLabel("Data de envio")).toBeDisabled();
    await expect(page.locator("#dasStatus")).toHaveCSS("opacity", "0.5");
    await expect(page.getByLabel("Data de envio")).toHaveCSS("opacity", "0.5");
    await expect(page.getByLabel("Empresa", { exact: true })).toHaveCSS("opacity", "0.5");
    await expect(page.getByLabel("CNPJ", { exact: true })).toHaveCSS("opacity", "0.5");

    await page.getByLabel("Observações gerais").fill("Edição com DAS já enviado.");
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(page).toHaveURL("/simples-nacional");

    await page.goto(`/clientes/${clienteId}`);
    await expect(page.getByLabel("Observações gerais")).toHaveValue("Edição com DAS já enviado.");
    await expect(page.locator("#dasStatus")).toHaveValue("enviado");
    await expect(page.getByLabel("Data de envio")).toHaveValue("2026-10-05");
  });

  test("se a hidratação falhar, o formulário aparece sozinho em alguns segundos", async ({
    page,
  }) => {
    const cnpjDigits = await criarClienteComoAdmin(page, "Cadastro Hidratacao E2E Ltda");
    const clienteId = await buscarClienteIdPorCnpj(cnpjDigits);
    await logout(page);
    await login(page, "admin@rigonicontabil.local", "admin123");
    await expect(page).toHaveURL("/");

    await page.route("**/_next/static/**/*.js", (rota) => rota.abort());
    await page.goto(`/clientes/${clienteId}`);

    await expect(page.getByLabel("Empresa", { exact: true })).toBeVisible({ timeout: 8_000 });
  });

  test("Funcionário de outro Setor só visualiza: campos desabilitados e sem botão Salvar", async ({
    page,
  }) => {
    const cnpjDigits = await criarClienteComoAdmin(page, "Cadastro Operacional Visual E2E Ltda");
    const clienteId = await buscarClienteIdPorCnpj(cnpjDigits);
    await tornarFinanceiroResponsavel(clienteId);

    await logout(page);
    await login(page, "funcionario.financeiro@rigonicontabil.local", "func123");
    await expect(page).toHaveURL("/");
    await page.goto(`/clientes/${clienteId}`);

    await expect(
      page.getByRole("heading", { name: "Visualizar cadastro operacional" }),
    ).toBeVisible();
    await expect(page.getByLabel("Documento recebido")).toBeDisabled();
    await expect(page.getByRole("button", { name: "Salvar" })).not.toBeVisible();
    await expect(page.getByLabel("Documento recebido")).toHaveCSS("opacity", "0.5");
    await expect(page.getByLabel("Observações gerais")).toHaveCSS("opacity", "0.5");
    await expect(page.getByRole("button", { name: "Adicionar contato" })).toBeHidden();
  });

  test("Contrato social só tem botão para quem pode vê-lo (#140)", async ({ page }) => {
    const cnpjDigits = await criarClienteComoAdmin(page, "Cadastro Operacional Contrato E2E Ltda");
    const clienteId = await buscarClienteIdPorCnpj(cnpjDigits);
    await tornarFinanceiroResponsavel(clienteId);
    const botao = page.getByRole("button", { name: /^Abrir em nova aba: Contrato social/ });

    await page.goto(`/clientes/${clienteId}`);
    await expect(botao).toBeVisible();

    await logout(page);
    await login(page, "funcionario.sn@rigonicontabil.local", "func123");
    await expect(page).toHaveURL("/simples-nacional");
    await page.goto(`/clientes/${clienteId}`);
    await expect(page).toHaveURL("/simples-nacional");
    await expect(botao).toBeHidden();

    await logout(page);
    await login(page, "funcionario.financeiro@rigonicontabil.local", "func123");
    await expect(page).toHaveURL("/");
    await page.goto(`/clientes/${clienteId}`);
    await expect(
      page.getByRole("heading", { name: "Visualizar cadastro operacional" }),
    ).toBeVisible();
    await expect(botao).toBeHidden();
  });
});
