/**
 * Integração infra ↔ Supabase (testes.md, seção 3) para o read model do #34.
 * Requer `npx supabase start` local com migrations + seed aplicados.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { Cliente } from "@/modules/clientes/domain/entities/cliente.entity";
import { SupabaseClienteRepository } from "@/modules/clientes/infra/repositories/cliente.repository";

import { SupabaseClienteQueryGateway } from "./cliente-query.gateway";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

async function clienteAutenticado(email: string, senha: string): Promise<SupabaseClient> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) throw new Error(`Falha ao autenticar ${email}: ${error.message}`);
  return supabase;
}

const comoAdmin = () => clienteAutenticado("admin@rigonicontabil.local", "admin123");
const comoFuncionarioSN = () =>
  clienteAutenticado("funcionario.sn@rigonicontabil.local", "func123");

// CNPJ único e válido (timestamp + contador, dígitos verificadores calculados
// pelo mesmo algoritmo mod 11 dos outros arquivos de teste de integração/e2e)
// — evita colisão de unique constraint quando mais de um teste cria cliente
// na mesma execução.
const PESOS_PRIMEIRO_DIGITO = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const PESOS_SEGUNDO_DIGITO = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
let contadorCnpj = 0;

function digitoVerificador(base: string, pesos: number[]): string {
  const soma = base
    .split("")
    .reduce((acumulado, digito, indice) => acumulado + Number(digito) * pesos[indice], 0);
  const resto = soma % 11;
  return String(resto < 2 ? 0 : 11 - resto);
}

function cnpjUnico(): string {
  contadorCnpj += 1;
  const raiz = `${Date.now()}`.slice(-8) + String(contadorCnpj).padStart(4, "0");
  const d1 = digitoVerificador(raiz, PESOS_PRIMEIRO_DIGITO);
  const d2 = digitoVerificador(raiz + d1, PESOS_SEGUNDO_DIGITO);
  return raiz + d1 + d2;
}

async function criarClienteComContratoSocial(
  admin: SupabaseClient,
  empresa = "Padaria Pão Quente Ltda",
  cnpj = "11444777000676",
  regime = "simples_nacional",
): Promise<Cliente> {
  const repositorio = new SupabaseClienteRepository(admin);
  const construido = Cliente.builder()
    .comId(crypto.randomUUID())
    .comEmpresa(empresa)
    .comCnpj(cnpj)
    .comRegime(regime)
    .comContratoSocialCaminho("clientes/x/contrato-social/doc.pdf")
    .comAlteracoesContratuais([])
    .build();
  if (!construido.ok) throw new Error("setup inválido");
  const salvo = await repositorio.criar(construido.value);
  if (!salvo.ok) throw new Error("falha ao criar cliente base: " + salvo.error.message);
  return construido.value;
}

describe("SupabaseClienteQueryGateway (#34, integração)", () => {
  it("devolve o cadastro operacional sem contrato social/alterações, mesmo o cliente tendo contrato social salvo", async () => {
    const admin = await comoAdmin();
    const cliente = await criarClienteComContratoSocial(admin);
    const gateway = new SupabaseClienteQueryGateway(admin);

    const resultado = await gateway.buscarCadastroOperacional(cliente.id);

    expect(resultado.ok).toBe(true);
    if (!resultado.ok || !resultado.value) throw new Error("cliente não encontrado");
    expect(resultado.value.empresa).toBe("Padaria Pão Quente Ltda");
    expect(resultado.value).not.toHaveProperty("contratoSocialCaminho");
    expect(resultado.value).not.toHaveProperty("alteracoesContratuais");
  });

  it("devolve null quando o Cliente não existe", async () => {
    const admin = await comoAdmin();
    const gateway = new SupabaseClienteQueryGateway(admin);

    const resultado = await gateway.buscarCadastroOperacional(crypto.randomUUID());

    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.value).toBeNull();
  });
});

describe("SupabaseClienteQueryGateway.buscarPorTermo (#35, integração)", () => {
  it("encontra o cliente por um trecho do CNPJ e por um trecho do nome da empresa", async () => {
    const admin = await comoAdmin();
    const cliente = await criarClienteComContratoSocial(
      admin,
      "Padaria Pão Quente Busca Ltda",
      cnpjUnico(),
    );
    const gateway = new SupabaseClienteQueryGateway(admin);

    const porCnpj = await gateway.buscarPorTermo(cliente.cnpj.valor.slice(0, 6));
    const porNome = await gateway.buscarPorTermo("Pão Quente");

    expect(porCnpj.ok).toBe(true);
    if (porCnpj.ok) expect(porCnpj.value.some((s) => s.id === cliente.id)).toBe(true);

    expect(porNome.ok).toBe(true);
    if (porNome.ok) expect(porNome.value.some((s) => s.id === cliente.id)).toBe(true);
  });

  it("Funcionário SN (não-Admin) também encontra o cliente, pela view sem contrato social (PR #69)", async () => {
    const admin = await comoAdmin();
    const cliente = await criarClienteComContratoSocial(
      admin,
      "Padaria Busca Funcionario Ltda",
      cnpjUnico(),
    );
    const gateway = new SupabaseClienteQueryGateway(await comoFuncionarioSN());

    const resultado = await gateway.buscarPorTermo("Busca Funcionario");

    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.value.some((s) => s.id === cliente.id)).toBe(true);
  });

  it("devolve lista vazia quando o termo não casa com nenhum cliente", async () => {
    const admin = await comoAdmin();
    const gateway = new SupabaseClienteQueryGateway(admin);

    const resultado = await gateway.buscarPorTermo("termo-sem-match-nenhum-xyz");

    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.value).toEqual([]);
  });

  it("trata vírgula no termo como texto literal, sem quebrar a sintaxe do filtro", async () => {
    const admin = await comoAdmin();
    const cliente = await criarClienteComContratoSocial(
      admin,
      "Pão, Quente e Companhia Ltda",
      cnpjUnico(),
    );
    const gateway = new SupabaseClienteQueryGateway(admin);

    const resultado = await gateway.buscarPorTermo("Pão, Quente");

    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.value.some((s) => s.id === cliente.id)).toBe(true);
  });

  it("nunca traz Cliente de Lucro Presumido/Real — esta busca é a do dashboard do SN, só Simples Nacional/MEI têm cadastro operacional", async () => {
    const admin = await comoAdmin();
    const empresa = "Padaria Busca Presumido Ltda";
    await criarClienteComContratoSocial(admin, empresa, cnpjUnico(), "lucro_presumido");
    const gateway = new SupabaseClienteQueryGateway(admin);

    const resultado = await gateway.buscarPorTermo("Busca Presumido");

    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.value).toEqual([]);
  });

  it("encontra Cliente MEI normalmente", async () => {
    const admin = await comoAdmin();
    const empresa = "Oficina Busca MEI Ltda";
    const cliente = await criarClienteComContratoSocial(admin, empresa, cnpjUnico(), "mei");
    const gateway = new SupabaseClienteQueryGateway(admin);

    const resultado = await gateway.buscarPorTermo("Busca MEI");

    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.value.some((s) => s.id === cliente.id)).toBe(true);
  });
});
