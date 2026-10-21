import { createClient } from "@supabase/supabase-js";

import { expect, test } from "./fixtures";
import {
  atribuirResponsavelComoLider,
  criarClienteComoAdmin,
  login,
} from "./support/criar-cliente";

// Playwright roda o arquivo de teste fora do Next (não carrega .env.local
// automaticamente como o runner do Jest faz) — fallback pra chave anon
// pública padrão do Supabase local (supabase/.env.local, não é segredo).
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

test.describe("Editar cadastro operacional do Cliente (#34)", () => {
  test("Funcionário SN edita o cadastro operacional, salvar fecha a tela e a alteração persiste", async ({
    page,
  }) => {
    const cnpjDigits = await criarClienteComoAdmin(page, "Cadastro Operacional E2E Ltda");
    const clienteId = await buscarClienteIdPorCnpj(cnpjDigits);
    await atribuirResponsavelComoLider(cnpjDigits);

    await logout(page);
    await login(page, "funcionario.sn@rigonicontabil.local", "func123");
    // Simples Nacional é a página principal do próprio setor.
    await expect(page).toHaveURL("/simples-nacional");
    await page.goto(`/clientes/${clienteId}`);

    await expect(page.getByRole("heading", { name: "Editar cadastro operacional" })).toBeVisible();
    // Espera a hidratação: preencher antes dela deixa o React Hook Form
    // reaplicar os valores iniciais por cima do que foi digitado (flaky no
    // dev server frio, o salvar gravava os defaults).
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);

    await page.getByLabel("Forma de envio").selectOption("email");
    await page.getByRole("button", { name: "Adicionar contato" }).click();
    await page.getByLabel("Nome").fill("Maria Contato");
    await page.getByLabel("Telefone").fill("11999998888");
    await page.getByLabel("Documento recebido").selectOption("positivo");
    // "Enviado" e a data de envio são só do sistema (#108).
    await expect(page.getByLabel("DAS").getByRole("option", { name: "Enviado" })).toHaveCount(0);
    await expect(page.getByLabel("Data de envio")).toHaveAttribute("readonly", "");
    await page.getByLabel("DAS").selectOption("pronto");
    await page.getByRole("checkbox", { name: "Comércio" }).check();
    await page.getByLabel("Observações gerais").fill("Observação de teste E2E.");

    await page.getByRole("button", { name: "Salvar" }).click();

    // Salvar fecha a tela e volta pro destino certo (sem ?voltarPara= nesta navegação, cai em "/",
    // que redireciona Funcionário SN de volta pra página principal do próprio setor).
    await expect(page).toHaveURL("/simples-nacional");

    // Reabre a tela do cliente pra conferir que a alteração persistiu.
    await page.goto(`/clientes/${clienteId}`);

    await expect(page.getByLabel("Forma de envio")).toHaveValue("email");
    await expect(page.getByLabel("Nome")).toHaveValue("Maria Contato");
    await expect(page.getByLabel("Telefone")).toHaveValue("(11) 99999-8888");
    await expect(page.getByLabel("Documento recebido")).toHaveValue("positivo");
    await expect(page.getByLabel("DAS")).toHaveValue("pronto");
    await expect(page.getByRole("checkbox", { name: "Comércio" })).toBeChecked();
    await expect(page.getByLabel("Observações gerais")).toHaveValue("Observação de teste E2E.");
  });

  test("Funcionário de outro Setor só visualiza: campos desabilitados e sem botão Salvar", async ({
    page,
  }) => {
    const cnpjDigits = await criarClienteComoAdmin(page, "Cadastro Operacional Visual E2E Ltda");
    const clienteId = await buscarClienteIdPorCnpj(cnpjDigits);

    await logout(page);
    await login(page, "funcionario.financeiro@rigonicontabil.local", "func123");
    await expect(page).toHaveURL("/");
    await page.goto(`/clientes/${clienteId}`);

    await expect(
      page.getByRole("heading", { name: "Visualizar cadastro operacional" }),
    ).toBeVisible();
    await expect(page.getByLabel("Forma de envio")).toBeDisabled();
    await expect(page.getByRole("button", { name: "Salvar" })).not.toBeVisible();
  });

  test("Contrato social só tem botão para quem pode vê-lo (#140)", async ({ page }) => {
    const cnpjDigits = await criarClienteComoAdmin(page, "Cadastro Operacional Contrato E2E Ltda");
    const clienteId = await buscarClienteIdPorCnpj(cnpjDigits);
    const botao = page.getByRole("button", { name: "Visualizar contrato social" });

    await page.goto(`/clientes/${clienteId}`);
    await expect(botao).toBeVisible();

    await logout(page);
    await login(page, "funcionario.sn@rigonicontabil.local", "func123");
    // Simples Nacional é a página principal do próprio setor.
    await expect(page).toHaveURL("/simples-nacional");
    // Não é Responsável deste Cliente: nem a tela abre.
    await page.goto(`/clientes/${clienteId}`);
    await expect(page).toHaveURL("/simples-nacional");
    await expect(botao).toBeHidden();

    await logout(page);
    await login(page, "funcionario.financeiro@rigonicontabil.local", "func123");
    await expect(page).toHaveURL("/");
    // Outro Setor vê o cadastro só para leitura, sem acesso ao contrato.
    await page.goto(`/clientes/${clienteId}`);
    await expect(
      page.getByRole("heading", { name: "Visualizar cadastro operacional" }),
    ).toBeVisible();
    await expect(botao).toBeHidden();
  });
});
