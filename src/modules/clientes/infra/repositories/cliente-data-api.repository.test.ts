/**
 * Integração direto pela Data API (PostgREST), sem passar por nenhum repositório
 * — prova o que o banco entrega a quem ignora a aplicação (devolutiva técnica
 * PR #69, pontos 1, 2 e 3). Requer `npx supabase start` com migrations + seed.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { Cliente } from "@/modules/clientes/domain/entities/cliente.entity";
import { primeiroDiaDoMesAtual } from "@/shared/kernel/mes-atual";

import { SupabaseClienteRepository } from "./cliente.repository";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const FUNCIONARIO_SN_ID = "22222222-2222-2222-2222-222222222222";

async function clienteAutenticado(email: string, senha: string): Promise<SupabaseClient> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) throw new Error(`Falha ao autenticar ${email}: ${error.message}`);
  return supabase;
}

const comoAdmin = () => clienteAutenticado("admin@rigonicontabil.local", "admin123");
const comoFuncionarioSN = () =>
  clienteAutenticado("funcionario.sn@rigonicontabil.local", "func123");
const comoFuncionarioFinanceiro = () =>
  clienteAutenticado("funcionario.financeiro@rigonicontabil.local", "func123");

const serviceRole = () =>
  createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

async function criarClienteComContrato(cnpj: string): Promise<Cliente> {
  const admin = await comoAdmin();
  const construido = Cliente.builder()
    .comId(crypto.randomUUID())
    .comEmpresa("Padaria Pão Quente Ltda")
    .comCnpj(cnpj)
    .comRegime("simples_nacional")
    .comContratoSocialCaminho("clientes/x/contrato-social/doc.pdf")
    .comAlteracoesContratuais([{ data: "2026-01-10", arquivoCaminho: "clientes/x/alt/1.pdf" }])
    .build();
  if (!construido.ok) throw new Error("setup inválido");
  const salvo = await new SupabaseClienteRepository(admin).criar(construido.value);
  if (!salvo.ok) throw new Error("falha ao criar cliente: " + salvo.error.message);
  return construido.value;
}

// Conta com senha provisória AINDA válida (dentro das 48h) e primeiro acesso
// não finalizado — o caso que meu_papel()/meu_setor() sozinhos deixavam passar.
async function criarContaEmPrimeiroAcesso(): Promise<{ id: string; email: string; senha: string }> {
  const admin = serviceRole();
  const email = `teste-primeiro-acesso-${crypto.randomUUID()}@rigonicontabil.local`;
  const senha = "senha-provisoria-123";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`Falha ao criar conta de teste: ${error?.message}`);
  const { error: erroPerfil } = await admin.from("perfis").insert({
    id: data.user.id,
    nome: "Funcionário Primeiro Acesso",
    email,
    papel: "funcionario",
    setor: "simples_nacional",
    senha_trocada_em: null,
    senha_provisoria_expira_em: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
  });
  if (erroPerfil) throw new Error(`Falha ao salvar perfil de teste: ${erroPerfil.message}`);
  return { id: data.user.id, email, senha };
}

const paramsEdicao = (clienteId: string) => ({
  p_cliente_id: clienteId,
  p_forma_envio: "email",
  p_documento_obrigatorio: "positivo",
  p_das_status: "pronto",
  p_data_envio_das: null,
  p_tem_parcelamento: false,
  p_parcelamento_status: null,
  p_observacoes_gerais: "teste",
  p_contatos: [{ id: crypto.randomUUID(), nome: "Maria", telefone: "11999990000", padrao: true }],
  p_ano_mes: primeiroDiaDoMesAtual(),
  p_industria: false,
  p_comercio: true,
  p_servico: false,
});

describe("Data API — confidencialidade dos documentos jurídicos (PR #69, ponto 1)", () => {
  it("Funcionário SN e de outro Setor não leem clientes nem alterações contratuais direto, mas leem a projeção segura", async () => {
    const cliente = await criarClienteComContrato("11444777000838");

    for (const supabase of [await comoFuncionarioSN(), await comoFuncionarioFinanceiro()]) {
      const direto = await supabase.from("clientes").select("*").eq("id", cliente.id);
      expect(direto.data).toEqual([]);

      const alteracoes = await supabase
        .from("cliente_alteracoes_contratuais")
        .select("*")
        .eq("cliente_id", cliente.id);
      expect(alteracoes.data).toEqual([]);

      const projecao = await supabase.from("clientes_basico").select("*").eq("id", cliente.id);
      expect(projecao.data).toEqual([
        {
          id: cliente.id,
          empresa: "Padaria Pão Quente Ltda",
          cnpj: "11444777000838",
          regime: "simples_nacional",
        },
      ]);

      const contrato = await supabase.from("clientes_basico").select("contrato_social_caminho");
      expect(contrato.error).not.toBeNull();
    }
  });

  it("Admin continua lendo o contrato social em clientes", async () => {
    const cliente = await criarClienteComContrato("11444777000919");
    const admin = await comoAdmin();

    const { data } = await admin
      .from("clientes")
      .select("contrato_social_caminho")
      .eq("id", cliente.id)
      .single();

    expect(data?.contrato_social_caminho).toBe("clientes/x/contrato-social/doc.pdf");
  });
});

describe("Data API — primeiro acesso não finalizado (PR #69, ponto 2)", () => {
  it("conta com senha provisória não lê nem edita dados de negócio; depois da troca, passa a ter o acesso normal", async () => {
    const cliente = await criarClienteComContrato("11444777001052");
    const conta = await criarContaEmPrimeiroAcesso();
    const supabase = await clienteAutenticado(conta.email, conta.senha);

    const leitura = await supabase.from("clientes_basico").select("*").eq("id", cliente.id);
    expect(leitura.data).toEqual([]);
    const operacional = await supabase
      .from("cliente_cadastro_operacional_sn")
      .select("*")
      .eq("cliente_id", cliente.id);
    expect(operacional.data).toEqual([]);

    const edicao = await supabase.rpc(
      "editar_cadastro_operacional_cliente",
      paramsEdicao(cliente.id),
    );
    expect(edicao.error?.message).toMatch(/row-level security/i);

    // o próprio perfil segue legível pro fluxo de troca de senha
    const proprio = await supabase.from("perfis").select("id").eq("id", conta.id);
    expect(proprio.data).toHaveLength(1);

    await serviceRole()
      .from("perfis")
      .update({ senha_trocada_em: new Date().toISOString() })
      .eq("id", conta.id);

    const depois = await supabase.from("clientes_basico").select("*").eq("id", cliente.id);
    expect(depois.data).toHaveLength(1);
    const edicaoDepois = await supabase.rpc(
      "editar_cadastro_operacional_cliente",
      paramsEdicao(cliente.id),
    );
    expect(edicaoDepois.error).toBeNull();
  });
});

describe("Auditoria atômica da edição (PR #69, ponto 3)", () => {
  async function eventosDeEdicao(cnpj: string): Promise<number> {
    const { data, error } = await serviceRole()
      .from("registros_auditoria")
      .select("id")
      .eq("acao", "cliente.editar-operacional")
      .eq("alvo", cnpj);
    if (error) throw new Error(error.message);
    return data.length;
  }

  it("cada edição gera exatamente um evento de sucesso, com ator e setor da sessão", async () => {
    const cnpj = "11444777001133";
    const cliente = await criarClienteComContrato(cnpj);
    const supabase = await comoFuncionarioSN();

    expect(await eventosDeEdicao(cnpj)).toBe(0);
    const primeira = await supabase.rpc(
      "editar_cadastro_operacional_cliente",
      paramsEdicao(cliente.id),
    );
    expect(primeira.error).toBeNull();
    expect(await eventosDeEdicao(cnpj)).toBe(1);
    const segunda = await supabase.rpc(
      "editar_cadastro_operacional_cliente",
      paramsEdicao(cliente.id),
    );
    expect(segunda.error).toBeNull();
    expect(await eventosDeEdicao(cnpj)).toBe(2);

    const { data } = await serviceRole()
      .from("registros_auditoria")
      .select("ator, setor, resultado")
      .eq("alvo", cnpj)
      .eq("acao", "cliente.editar-operacional")
      .limit(1)
      .single();
    expect(data).toEqual({
      ator: FUNCIONARIO_SN_ID,
      setor: "simples_nacional",
      resultado: "sucesso",
    });
  });

  it("edição que falha (contato inválido) não deixa evento de sucesso", async () => {
    const cnpj = "11444777001214";
    const cliente = await criarClienteComContrato(cnpj);
    const supabase = await comoFuncionarioSN();

    const { error } = await supabase.rpc("editar_cadastro_operacional_cliente", {
      ...paramsEdicao(cliente.id),
      p_contatos: [{ nome: null, telefone: "1", padrao: true }],
    });

    expect(error).not.toBeNull();
    expect(await eventosDeEdicao(cnpj)).toBe(0);
  });
});
