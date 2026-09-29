/**
 * Integração infra ↔ Supabase (testes.md, seção 3): requer `npx supabase start`
 * rodando localmente com as migrations e o seed aplicados. Usa os usuários de
 * `supabase/seed.sql`: Admin (administrativo) e Funcionário SN (simples_nacional)
 * — prova a policy `clientes_insert_admin`/`cliente_alteracoes_insert_admin`.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { Cliente } from "@/modules/clientes/domain/entities/cliente.entity";

import { SupabaseClienteRepository } from "./cliente.repository";

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

function clienteValido(cnpj: string): Cliente {
  const resultado = Cliente.builder()
    .comId(crypto.randomUUID())
    .comEmpresa("Padaria Pão Quente Ltda")
    .comCnpj(cnpj)
    .comRegime("simples_nacional")
    .comContratoSocialCaminho(`${crypto.randomUUID()}/contrato-social/doc.pdf`)
    .comAlteracoesContratuais([
      { data: "2026-02-01", arquivoCaminho: `${crypto.randomUUID()}/alteracoes/0-doc.pdf` },
    ])
    .build();
  if (!resultado.ok) throw new Error("setup inválido");
  return resultado.value;
}

describe("SupabaseClienteRepository (integração)", () => {
  it("Admin cadastra um Cliente com Alterações contratuais (RPC criar_cliente)", async () => {
    const supabase = await comoAdmin();
    const repositorio = new SupabaseClienteRepository(supabase);
    const cliente = clienteValido("11444777000161");

    const resultado = await repositorio.criar(cliente);

    expect(resultado.ok).toBe(true);
    const { data: linha } = await supabase
      .from("clientes")
      .select("*")
      .eq("id", cliente.id)
      .maybeSingle();
    expect(linha?.cnpj).toBe("11444777000161");
    const { data: alteracoes } = await supabase
      .from("cliente_alteracoes_contratuais")
      .select("*")
      .eq("cliente_id", cliente.id);
    expect(alteracoes).toHaveLength(1);
  });

  it("Admin cadastra um Cliente sem contrato social (campo opcional, decisão de produto 2026-09-29)", async () => {
    const supabase = await comoAdmin();
    const repositorio = new SupabaseClienteRepository(supabase);
    const resultado_construcao = Cliente.builder()
      .comId(crypto.randomUUID())
      .comEmpresa("Padaria Pão Quente Ltda")
      .comCnpj("20045044000145")
      .comRegime("simples_nacional")
      .comContratoSocialCaminho(null)
      .comAlteracoesContratuais([])
      .build();
    if (!resultado_construcao.ok) throw new Error("setup inválido");

    const resultado = await repositorio.criar(resultado_construcao.value);

    expect(resultado.ok).toBe(true);
    const { data: linha } = await supabase
      .from("clientes")
      .select("*")
      .eq("id", resultado_construcao.value.id)
      .maybeSingle();
    expect(linha?.contrato_social_caminho).toBeNull();
  });

  it("rejeita CNPJ duplicado (constraint unique)", async () => {
    const supabase = await comoAdmin();
    const repositorio = new SupabaseClienteRepository(supabase);
    const cnpj = "11222333000181";
    await repositorio.criar(clienteValido(cnpj));

    const resultado = await repositorio.criar(clienteValido(cnpj));

    expect(resultado.ok).toBe(false);
  });

  it("Funcionário não pode cadastrar Cliente (RLS)", async () => {
    const supabase = await comoFuncionarioSN();
    const repositorio = new SupabaseClienteRepository(supabase);

    const resultado = await repositorio.criar(clienteValido("11444777000161"));

    expect(resultado.ok).toBe(false);
  });
});
