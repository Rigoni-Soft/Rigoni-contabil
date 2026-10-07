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

async function criarClienteComContratoSocial(admin: SupabaseClient): Promise<Cliente> {
  const repositorio = new SupabaseClienteRepository(admin);
  const construido = Cliente.builder()
    .comId(crypto.randomUUID())
    .comEmpresa("Padaria Pão Quente Ltda")
    .comCnpj("11444777000676")
    .comRegime("simples_nacional")
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
