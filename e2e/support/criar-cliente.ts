import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// Playwright roda fora do Next (não carrega .env.local) — fallback pra chave
// anon pública padrão do Supabase local (supabase/.env.local, não é segredo).
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

// Compartilhado entre editar-cadastro-operacional.e2e.ts (#34) e
// busca-cliente-dashboard.e2e.ts (#35) — ambos precisam logar como Admin e
// cadastrar um Cliente Simples Nacional válido antes do cenário que testam
// de fato (ponytail-review: estava duplicado igual nos dois arquivos).

export async function login(page: Page, email: string, senha: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(senha);
  await page.getByRole("button", { name: "Entrar" }).click();
}

export function pdf(nome: string) {
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

export function cnpjUnico(): string {
  const raiz = `${Date.now()}`.slice(-8) + "0001";
  const d1 = digitoVerificador(raiz, PESOS_PRIMEIRO_DIGITO);
  const d2 = digitoVerificador(raiz + d1, PESOS_SEGUNDO_DIGITO);
  return raiz + d1 + d2;
}

// #65: Funcionário SN só enxerga/edita Cliente do qual é Responsável, e só o
// Líder do SN atribui — este helper faz o papel do Líder direto no banco
// (mesmo caminho que a UI usa), pra e2e de outros tickets não dependerem da tela.
export async function atribuirResponsavelComoLider(cnpjDigits: string): Promise<string> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { error: erroLogin } = await supabase.auth.signInWithPassword({
    email: "lider.sn@rigonicontabil.local",
    password: "lider123",
  });
  if (erroLogin) throw new Error(`Falha ao autenticar Líder SN: ${erroLogin.message}`);

  const { data: cliente, error: erroCliente } = await supabase
    .from("clientes")
    .select("id")
    .eq("cnpj", cnpjDigits)
    .single();
  if (erroCliente || !cliente) throw new Error(`Cliente não encontrado: ${erroCliente?.message}`);

  const { data: funcionario, error: erroFuncionario } = await supabase
    .from("perfis")
    .select("id")
    .eq("email", "funcionario.sn@rigonicontabil.local")
    .single();
  if (erroFuncionario || !funcionario) {
    throw new Error(`Funcionário não encontrado: ${erroFuncionario?.message}`);
  }

  const { error } = await supabase
    .from("cliente_cadastro_operacional_sn")
    .update({ responsavel_id: funcionario.id })
    .eq("cliente_id", cliente.id);
  if (error) throw new Error(`Falha ao atribuir Responsável: ${error.message}`);
  return cliente.id as string;
}

export async function criarClienteComoAdmin(
  page: Page,
  empresa: string,
  regime: "simples_nacional" | "mei" | "lucro_presumido" | "lucro_real" = "simples_nacional",
) {
  const cnpjDigits = cnpjUnico();
  await login(page, "admin@rigonicontabil.local", "admin123");
  await expect(page).toHaveURL("/");
  await page.goto("/admin/clientes/novo");

  await page.getByLabel("Empresa").fill(empresa);
  await page.getByLabel("CNPJ").fill(cnpjDigits);
  await page.getByLabel("Regime").selectOption(regime);
  await page.getByLabel("Contrato social").setInputFiles(pdf("contrato-social.pdf"));
  await page.getByRole("button", { name: "Cadastrar" }).click();

  await expect(page.getByText(empresa)).toBeVisible();
  return cnpjDigits;
}
