/**
 * Integração infra ↔ Supabase (testes.md, seção 3) do Responsável por Cliente fora do Simples
 * Nacional: o Líder do Setor atribui, troca e remove em `cliente_responsaveis`; quem não é
 * Líder do Setor ou aponta Funcionário de outro Setor é recusado pelo banco.
 * Requer `npx supabase start` local com migrations + seed aplicados.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { SupabaseClienteQueryGateway } from "@/modules/clientes/infra/gateways/cliente-query.gateway";

import { SupabaseResponsavelClienteRepository } from "./responsavel-cliente.repository";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const servidor = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function como(email: string, senha: string): Promise<SupabaseClient> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) throw new Error(`Falha ao autenticar ${email}: ${error.message}`);
  return supabase;
}

const clienteId = crypto.randomUUID();
const CNPJ = `6${Date.now()}`.slice(0, 14);
const usuarios: string[] = [];

async function criarFuncionario(nome: string, setor: string): Promise<string> {
  const { data } = await servidor.auth.admin.createUser({
    email: `resp-setor-${nome.replace(/\W/g, "")}-${Date.now()}@teste.local`,
    password: "senha-de-teste-123",
    email_confirm: true,
  });
  const id = data.user!.id;
  usuarios.push(id);
  await servidor
    .from("perfis")
    .insert({ id, nome, email: data.user!.email, papel: "funcionario", setor });
  return id;
}

const responsavelNoBanco = async () =>
  (
    await servidor
      .from("cliente_responsaveis")
      .select("responsavel_id")
      .eq("cliente_id", clienteId)
      .eq("setor", "contabil")
      .maybeSingle()
  ).data?.responsavel_id ?? null;

beforeAll(async () => {
  const cliente = await servidor
    .from("clientes")
    .insert({ id: clienteId, empresa: "Setor Resp Ltda", cnpj: CNPJ, regime: "lucro_presumido" });
  if (cliente.error) throw cliente.error;
});

afterAll(async () => {
  await servidor.from("clientes").delete().eq("id", clienteId);
  for (const id of usuarios) await servidor.auth.admin.deleteUser(id);
});

describe("Responsável por Cliente fora do Simples Nacional", () => {
  it("o Líder do Setor atribui, troca e remove; o gateway lê o atual e lista só Funcionários do Setor", async () => {
    const primeiro = await criarFuncionario("Primeiro Contabil Resp", "contabil");
    const segundo = await criarFuncionario("Segundo Contabil Resp", "contabil");
    const lider = await como("lider.contabil@rigonicontabil.local", "lider123");
    const repositorio = new SupabaseResponsavelClienteRepository(lider);
    const gateway = new SupabaseClienteQueryGateway(lider);

    expect((await repositorio.atribuir(clienteId, "contabil", primeiro)).ok).toBe(true);
    expect(await responsavelNoBanco()).toBe(primeiro);
    const atual = await gateway.buscarResponsavelDoSetor(clienteId, "contabil");
    expect(atual.ok && atual.value).toEqual({ id: primeiro, nome: "Primeiro Contabil Resp" });

    expect((await repositorio.atribuir(clienteId, "contabil", segundo)).ok).toBe(true);
    expect(await responsavelNoBanco()).toBe(segundo);

    const elegiveis = await gateway.listarResponsaveisElegiveis("contabil");
    expect(elegiveis.ok && elegiveis.value.map((o) => o.id)).toEqual(
      expect.arrayContaining([primeiro, segundo]),
    );
    expect(
      elegiveis.ok && elegiveis.value.every((o) => o.id !== "44444444-4444-4444-4444-444444444444"),
    ).toBe(true);

    expect((await repositorio.atribuir(clienteId, "contabil", null)).ok).toBe(true);
    expect(await responsavelNoBanco()).toBeNull();
    const vazio = await gateway.buscarResponsavelDoSetor(clienteId, "contabil");
    expect(vazio.ok && vazio.value).toBeNull();
  });

  it("recusa Funcionário de outro Setor e quem não é Líder do Setor", async () => {
    const doFinanceiro = await criarFuncionario("Financeiro Resp", "financeiro");
    const doContabil = await criarFuncionario("Contabil Resp Recusa", "contabil");
    const lider = await como("lider.contabil@rigonicontabil.local", "lider123");
    const funcionario = await como("funcionario.financeiro@rigonicontabil.local", "func123");

    const outroSetor = await new SupabaseResponsavelClienteRepository(lider).atribuir(
      clienteId,
      "contabil",
      doFinanceiro,
    );
    const semPapel = await new SupabaseResponsavelClienteRepository(funcionario).atribuir(
      clienteId,
      "contabil",
      doContabil,
    );

    expect(!outroSetor.ok && outroSetor.error.code).toBe("VALIDATION_ERROR");
    expect(semPapel.ok).toBe(false);
    expect(await responsavelNoBanco()).toBeNull();
  });
});
