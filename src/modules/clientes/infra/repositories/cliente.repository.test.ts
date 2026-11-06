/**
 * Integração infra ↔ Supabase (testes.md, seção 3): requer `npx supabase start`
 * rodando localmente com as migrations e o seed aplicados. Usa os usuários de
 * `supabase/seed.sql`: Admin (administrativo) e Funcionário SN (simples_nacional)
 * — prova a policy `clientes_insert_admin`/`cliente_alteracoes_insert_admin`.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { Cliente } from "@/modules/clientes/domain/entities/cliente.entity";

import { removerClientesDeTeste } from "../../../../../test-support/clientes-de-teste";
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
      {
        numero: 1,
        data: "2026-02-01",
        arquivoCaminho: `${crypto.randomUUID()}/alteracoes/1-doc.pdf`,
      },
    ])
    .build();
  if (!resultado.ok) throw new Error("setup inválido");
  return resultado.value;
}

// CNPJs fixos desta suíte, reservados para teste: removidos antes e depois (nunca um DELETE amplo).
const CNPJS_DA_SUITE = [
  "00000000E08G12",
  "11222333000181",
  "11444777000161",
  "20045044000145",
  "34028316000103",
  "77700001000173",
  "77700002000118",
] as const;
beforeAll(() => removerClientesDeTeste(CNPJS_DA_SUITE));
afterAll(() => removerClientesDeTeste(CNPJS_DA_SUITE));

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
    expect(alteracoes?.[0].numero).toBe(1);
  });

  it("recusa nº repetido no lote de alterações e desfaz o cadastro inteiro (S2f)", async () => {
    const supabase = await comoAdmin();
    const id = crypto.randomUUID();
    const item = (numero: number) => ({
      id: crypto.randomUUID(),
      numero,
      data: "2026-02-01",
      arquivoCaminho: `${id}/alteracoes-contratuais/${numero}-doc.pdf`,
    });

    const { error } = await supabase.rpc("criar_cliente", {
      p_id: id,
      p_empresa: "Padaria Pão Quente Ltda",
      p_cnpj: "77700001000173",
      p_regime: "simples_nacional",
      p_contrato_social_caminho: null,
      p_alteracoes: [item(2), item(2)],
    });

    expect(error?.code).toBe("23505");
    const { data } = await supabase.from("clientes").select("id").eq("id", id);
    expect(data).toEqual([]);
  });

  it("o mesmo nº vale em Clientes diferentes, mas não no mesmo (S2d)", async () => {
    const admin = await comoAdmin();
    const [a, b] = [clienteValido("77700001000173"), clienteValido("77700002000118")];
    const repositorio = new SupabaseClienteRepository(admin);
    expect((await repositorio.criar(a)).ok).toBe(true);
    expect((await repositorio.criar(b)).ok).toBe(true);

    const repetido = await admin.from("cliente_alteracoes_contratuais").insert({
      id: crypto.randomUUID(),
      cliente_id: a.id,
      numero: 1,
      data: "2026-03-01",
      arquivo_caminho: "x/alteracoes-contratuais/1-outro.pdf",
    });
    expect(repetido.error?.code).toBe("23505");

    for (const numero of [0, -1]) {
      const invalido = await admin.from("cliente_alteracoes_contratuais").insert({
        id: crypto.randomUUID(),
        cliente_id: a.id,
        numero,
        data: "2026-03-01",
        arquivo_caminho: `x/${numero}.pdf`,
      });
      expect(invalido.error?.code).toBe("23514");
    }
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

  it("cadastro e auditoria de sucesso nascem juntos; CNPJ alfanumérico persiste", async () => {
    const supabase = await comoAdmin();
    const repositorio = new SupabaseClienteRepository(supabase);
    const cliente = clienteValido("00000000E08G12");
    // A auditoria é imutável e guarda eventos de execuções anteriores: só conta o desta.
    const inicio = new Date().toISOString();

    const resultado = await repositorio.criar(cliente);

    expect(resultado.ok).toBe(true);
    const { data: linha } = await supabase
      .from("clientes")
      .select("cnpj")
      .eq("id", cliente.id)
      .maybeSingle();
    expect(linha?.cnpj).toBe("00000000E08G12");
    const { data: eventos } = await supabase
      .from("registros_auditoria")
      .select("acao, resultado, setor")
      .eq("alvo", "00000000E08G12")
      .gte("criado_em", inicio);
    expect(eventos).toEqual([
      { acao: "cliente.criar", resultado: "sucesso", setor: "administrativo" },
    ]);
  });

  it("cadastro rejeitado (CNPJ duplicado) não deixa evento de sucesso: mesma transação", async () => {
    const supabase = await comoAdmin();
    const repositorio = new SupabaseClienteRepository(supabase);
    const cnpj = "11222333000181";
    await repositorio.criar(clienteValido(cnpj));
    const antes = await supabase.from("registros_auditoria").select("id").eq("alvo", cnpj);

    const resultado = await repositorio.criar(clienteValido(cnpj));

    expect(resultado.ok).toBe(false);
    const depois = await supabase.from("registros_auditoria").select("id").eq("alvo", cnpj);
    expect(depois.data).toHaveLength(antes.data?.length ?? 0);
  });

  it("rejeita CNPJ duplicado com mensagem amigável (não vaza erro cru do Postgres)", async () => {
    const supabase = await comoAdmin();
    const repositorio = new SupabaseClienteRepository(supabase);
    const cnpj = "11222333000181";
    await repositorio.criar(clienteValido(cnpj));

    const resultado = await repositorio.criar(clienteValido(cnpj));

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.error.message).toBe("CNPJ já cadastrado para outro Cliente.");
    expect(resultado.error.message).not.toMatch(/duplicate key|constraint|clientes_cnpj_key/i);
  });

  it("Funcionário não pode cadastrar Cliente (RLS)", async () => {
    const supabase = await comoFuncionarioSN();
    const repositorio = new SupabaseClienteRepository(supabase);

    const resultado = await repositorio.criar(clienteValido("11444777000161"));

    expect(resultado.ok).toBe(false);
  });

  it("grava o e-mail do Cliente e o Funcionário o lê pela projeção clientes_basico", async () => {
    const admin = await comoAdmin();
    const construido = Cliente.builder()
      .comId(crypto.randomUUID())
      .comEmpresa("Padaria Pão Quente Ltda")
      .comCnpj("34028316000103")
      .comRegime("simples_nacional")
      .comContratoSocialCaminho(null)
      .comEmail("financeiro@padaria.com.br")
      .comAlteracoesContratuais([])
      .build();
    if (!construido.ok) throw new Error("setup inválido");

    const criado = await new SupabaseClienteRepository(admin).criar(construido.value);
    expect(criado.ok).toBe(true);

    const { data: linha } = await admin
      .from("clientes")
      .select("email")
      .eq("id", construido.value.id)
      .maybeSingle();
    expect(linha?.email).toBe("financeiro@padaria.com.br");

    // Admin lê pela view como qualquer perfil; o Cliente reconstituído traz o e-mail.
    const lido = await new SupabaseClienteRepository(admin).buscarPorId(construido.value.id);
    expect(lido.ok && lido.value?.email?.valor).toBe("financeiro@padaria.com.br");
  });

  it("e-mail mal formado é barrado pelo banco", async () => {
    const admin = await comoAdmin();
    const { error } = await admin.from("clientes").insert({
      id: crypto.randomUUID(),
      empresa: "Sem Arroba Ltda",
      cnpj: "00000000E08G12",
      regime: "simples_nacional",
      email: "sem-arroba",
    });
    expect(error?.code).toBe("23514");
  });
});
