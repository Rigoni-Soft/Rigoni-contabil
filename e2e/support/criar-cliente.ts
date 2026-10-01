import { expect, type Page } from "@playwright/test";

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
