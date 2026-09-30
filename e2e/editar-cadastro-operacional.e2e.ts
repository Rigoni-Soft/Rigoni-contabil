import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// Cobre os cenários do ticket #34 (Funcionário SN edita campos operacionais
// do cliente): edição, persistência, somente-leitura pra outro Setor e
// ausência do contrato social nesta tela. Usuários: supabase/seed.sql, Dev local.

// Playwright roda o arquivo de teste fora do Next (não carrega .env.local
// automaticamente como o runner do Jest faz) — fallback pra chave anon
// pública padrão do Supabase local (supabase/.env.local, não é segredo).
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

async function login(page: import("@playwright/test").Page, email: string, senha: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(senha);
  await page.getByRole("button", { name: "Entrar" }).click();
}

async function logout(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/login$/);
}

function pdf(nome: string) {
  return { name: nome, mimeType: "application/pdf", buffer: Buffer.from("conteúdo de teste") };
}

const PESOS_PRIMEIRO_DIGITO = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const PESOS_SEGUNDO_DIGITO = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

function digitoVerificador(base: string, pesos: number[]): string {
  const soma = base
    .split("")
    .reduce((acumulado, digito, indice) => acumulado + Number(digito) * pesos[indice], 0);
  const resto = soma % 11;
  return String(resto < 2 ? 0 : 11 - resto);
}

function cnpjUnico(): string {
  const raiz = `${Date.now()}`.slice(-8) + "0001";
  const d1 = digitoVerificador(raiz, PESOS_PRIMEIRO_DIGITO);
  const d2 = digitoVerificador(raiz + d1, PESOS_SEGUNDO_DIGITO);
  return raiz + d1 + d2;
}

async function criarClienteComoAdmin(page: import("@playwright/test").Page, empresa: string) {
  const cnpjDigits = cnpjUnico();
  await login(page, "admin@rigonicontabil.local", "admin123");
  await expect(page).toHaveURL("/");
  await page.goto("/admin/clientes/novo");

  await page.getByLabel("Empresa").fill(empresa);
  await page.getByLabel("CNPJ").fill(cnpjDigits);
  await page.getByLabel("Regime").selectOption("simples_nacional");
  await page.getByLabel("Contrato social").setInputFiles(pdf("contrato-social.pdf"));
  await page.getByRole("button", { name: "Cadastrar" }).click();

  await expect(page.getByText(empresa)).toBeVisible();
  return cnpjDigits;
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
  test("Funcionário SN edita o cadastro operacional e a alteração persiste após recarregar", async ({
    page,
  }) => {
    const cnpjDigits = await criarClienteComoAdmin(page, "Cadastro Operacional E2E Ltda");
    const clienteId = await buscarClienteIdPorCnpj(cnpjDigits);

    await logout(page);
    await login(page, "funcionario.sn@rigonicontabil.local", "func123");
    await expect(page).toHaveURL("/");
    await page.goto(`/clientes/${clienteId}`);

    await expect(page.getByRole("heading", { name: "Editar cadastro operacional" })).toBeVisible();

    await page.getByLabel("Forma de envio").selectOption("email");
    await page.getByRole("button", { name: "Adicionar contato" }).click();
    await page.getByLabel("Nome").fill("Maria Contato");
    await page.getByLabel("Telefone").fill("11999998888");
    await page.getByLabel("Documento recebido").selectOption("positivo");
    await page.getByLabel("DAS").selectOption("pronto");
    await page.getByRole("checkbox", { name: "Comércio" }).check();
    await page.getByLabel("Observações gerais").fill("Observação de teste E2E.");

    await page.getByRole("button", { name: "Salvar" }).click();

    await expect(page.getByText("Cadastro operacional atualizado.")).toBeVisible();

    await page.reload();

    await expect(page.getByLabel("Forma de envio")).toHaveValue("email");
    await expect(page.getByLabel("Nome")).toHaveValue("Maria Contato");
    await expect(page.getByLabel("Telefone")).toHaveValue("11999998888");
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

  test("Contrato social nunca aparece nesta tela, pra nenhum perfil", async ({ page }) => {
    const cnpjDigits = await criarClienteComoAdmin(page, "Cadastro Operacional Contrato E2E Ltda");
    const clienteId = await buscarClienteIdPorCnpj(cnpjDigits);

    await page.goto(`/clientes/${clienteId}`);
    await expect(page.getByText(/contrato social/i)).not.toBeVisible();

    await logout(page);
    await login(page, "funcionario.sn@rigonicontabil.local", "func123");
    await expect(page).toHaveURL("/");
    await page.goto(`/clientes/${clienteId}`);
    await expect(page.getByText(/contrato social/i)).not.toBeVisible();

    await logout(page);
    await login(page, "funcionario.financeiro@rigonicontabil.local", "func123");
    await expect(page).toHaveURL("/");
    await page.goto(`/clientes/${clienteId}`);
    await expect(page.getByText(/contrato social/i)).not.toBeVisible();
  });
});
