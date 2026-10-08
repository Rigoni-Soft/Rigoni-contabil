/**
 * Integração direto pela Data API (PostgREST) — devolutiva técnica PR #75,
 * pontos A, B e C. Prova o que o banco entrega a quem ignora a aplicação e o
 * ban do Auth: um JWT emitido ANTES da desativação, e o Responsável por Cliente
 * depois de desativação/promoção. Requer `npx supabase start` com migrations + seed.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { UsuarioId } from "@/modules/usuarios/domain/entities/usuario.entity";

import { SupabaseAlteracaoPapelGateway } from "./supabase-alteracao-papel.gateway";
import { SupabaseDesativacaoGateway } from "./supabase-desativacao.gateway";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const SENHA = "senha-de-teste-123";
const ADMIN_ID = "11111111-1111-1111-1111-111111111111" as UsuarioId;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const perfisCriados: string[] = [];
const clientesCriados: string[] = [];

async function criarFuncionarioSN(): Promise<{ id: UsuarioId; email: string }> {
  const email = `teste-${crypto.randomUUID()}@rigonicontabil.local`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: SENHA,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`Falha ao criar conta de teste: ${error?.message}`);
  perfisCriados.push(data.user.id);
  const { error: erroPerfil } = await admin.from("perfis").insert({
    id: data.user.id,
    nome: "Teste",
    email,
    papel: "funcionario",
    setor: "simples_nacional",
    senha_trocada_em: new Date().toISOString(),
  });
  if (erroPerfil) throw new Error(`setup inválido: ${erroPerfil.message}`);
  return { id: data.user.id as UsuarioId, email };
}

async function criarCliente(responsavelId: string): Promise<string> {
  const id = crypto.randomUUID();
  const cnpj = String(Math.floor(Math.random() * 1e14)).padStart(14, "0");
  clientesCriados.push(id);
  const { error } = await admin
    .from("clientes")
    .insert({ id, empresa: "Cliente Teste Ltda", cnpj, regime: "simples_nacional" });
  if (error) throw new Error(`setup inválido: ${error.message}`);
  const { error: erroOperacional } = await admin
    .from("cliente_cadastro_operacional_sn")
    .insert({ cliente_id: id, das_status: "pendente", responsavel_id: responsavelId });
  if (erroOperacional) throw new Error(`setup inválido: ${erroOperacional.message}`);
  return id;
}

async function entrar(email: string, senha: string): Promise<SupabaseClient> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) throw new Error(`Falha ao autenticar ${email}: ${error.message}`);
  return supabase;
}

const responsavelDe = async (clienteId: string) =>
  (
    await admin
      .from("cliente_cadastro_operacional_sn")
      .select("responsavel_id, das_status")
      .eq("cliente_id", clienteId)
      .single()
  ).data;

const auditoriasDe = async (acao: string, alvoIds: string[]) => {
  const { data: clientes } = await admin.from("clientes").select("cnpj").in("id", alvoIds);
  const { data } = await admin
    .from("registros_auditoria")
    .select("alvo")
    .eq("acao", acao)
    .in(
      "alvo",
      (clientes ?? []).map((c) => c.cnpj),
    );
  return data ?? [];
};

afterEach(async () => {
  await admin.from("clientes").delete().in("id", clientesCriados);
  await admin.from("perfis").delete().in("id", perfisCriados);
  clientesCriados.length = 0;
  perfisCriados.length = 0;
});

describe("desativação: JWT já emitido perde o acesso no banco (ponto A)", () => {
  const desativacao = new SupabaseDesativacaoGateway(admin);

  it("Funcionário SN responsável: mesmo JWT lê e edita antes, e é negado em SELECT e DML depois", async () => {
    const funcionario = await criarFuncionarioSN();
    const clienteId = await criarCliente(funcionario.id);
    const comoFuncionario = await entrar(funcionario.email, SENHA);

    const antesLeitura = await comoFuncionario.from("clientes_basico").select("id");
    const antesEdicao = await comoFuncionario
      .from("cliente_cadastro_operacional_sn")
      .update({ observacoes_gerais: "antes" })
      .eq("cliente_id", clienteId)
      .select("cliente_id");
    expect(antesLeitura.data?.map((c) => c.id)).toContain(clienteId);
    expect(antesEdicao.data).toHaveLength(1);

    // Só a desativação no banco: sem ban no Auth, o JWT segue válido — é a
    // barreira de RLS que precisa negar sozinha.
    expect((await desativacao.desativar(funcionario.id, ADMIN_ID)).ok).toBe(true);

    const depoisLeitura = await comoFuncionario.from("clientes_basico").select("id");
    const depoisOperacional = await comoFuncionario
      .from("cliente_cadastro_operacional_sn")
      .select("cliente_id");
    const depoisEdicao = await comoFuncionario
      .from("cliente_cadastro_operacional_sn")
      .update({ observacoes_gerais: "depois" })
      .eq("cliente_id", clienteId)
      .select("cliente_id");
    const depoisContatos = await comoFuncionario.from("cliente_contatos").insert({
      id: crypto.randomUUID(),
      cliente_id: clienteId,
      nome: "x",
      telefone: "11999999999",
    });

    expect(depoisLeitura.data).toEqual([]);
    expect(depoisOperacional.data).toEqual([]);
    expect(depoisEdicao.data).toEqual([]);
    expect(depoisContatos.error).not.toBeNull();
  });

  it("Líder com JWT antigo deixa de ver perfis do Setor e Clientes", async () => {
    // Desativar um Líder do seed contaminaria os demais testes: a prova usa um
    // Líder temporário num Setor sem Líder no seed.
    const email = `teste-${crypto.randomUUID()}@rigonicontabil.local`;
    const { data } = await admin.auth.admin.createUser({
      email,
      password: SENHA,
      email_confirm: true,
    });
    const lider = data.user!.id as UsuarioId;
    perfisCriados.push(lider);
    await admin.from("perfis").insert({
      id: lider,
      nome: "Líder Teste",
      email,
      papel: "lider_setor",
      setor: "financeiro",
      senha_trocada_em: new Date().toISOString(),
    });
    const colega = await criarFuncionarioSN();
    await admin.from("perfis").update({ setor: "financeiro" }).eq("id", colega.id);
    const comoLider = await entrar(email, SENHA);

    const antes = await comoLider.from("perfis").select("id").eq("id", colega.id);
    expect(antes.data).toHaveLength(1);

    expect((await new SupabaseDesativacaoGateway(admin).desativar(lider, ADMIN_ID)).ok).toBe(true);

    const depois = await comoLider.from("perfis").select("id").eq("id", colega.id);
    const proprio = await comoLider.from("perfis").select("id").eq("id", lider);
    expect(depois.data).toEqual([]);
    // A conta ainda lê só o próprio perfil (necessário ao fluxo de sessão).
    expect(proprio.data).toHaveLength(1);
  });
});

describe("desativação: Responsável por Cliente (ponto B)", () => {
  const desativacao = new SupabaseDesativacaoGateway(admin);

  it("limpa as atribuições na mesma transação, sem mexer no resto do Cliente, e audita 1 vez por Cliente", async () => {
    const funcionario = await criarFuncionarioSN();
    const clientes = [await criarCliente(funcionario.id), await criarCliente(funcionario.id)];

    expect((await desativacao.desativar(funcionario.id, ADMIN_ID)).ok).toBe(true);
    expect((await desativacao.desativar(funcionario.id, ADMIN_ID)).ok).toBe(true);

    for (const id of clientes) {
      expect(await responsavelDe(id)).toEqual({ responsavel_id: null, das_status: "pendente" });
    }
    expect(await auditoriasDe("cliente.remover-responsavel", clientes)).toHaveLength(2);
  });

  it("conta sem Clientes desativa normalmente", async () => {
    const funcionario = await criarFuncionarioSN();

    expect((await desativacao.desativar(funcionario.id, ADMIN_ID)).ok).toBe(true);
  });

  it("não deixa reatribuir um desativado, nem pelo Líder via Data API nem pelo servidor", async () => {
    const inativo = await criarFuncionarioSN();
    const dono = await criarFuncionarioSN();
    const clienteId = await criarCliente(dono.id);
    await desativacao.desativar(inativo.id, ADMIN_ID);
    const comoLider = await entrar("lider.sn@rigonicontabil.local", "lider123");

    const pelaDataApi = await comoLider
      .from("cliente_cadastro_operacional_sn")
      .update({ responsavel_id: inativo.id })
      .eq("cliente_id", clienteId);
    const peloServidor = await admin
      .from("cliente_cadastro_operacional_sn")
      .update({ responsavel_id: inativo.id })
      .eq("cliente_id", clienteId);

    expect(pelaDataApi.error?.message).toMatch(/Funcionário ativo do Simples Nacional/);
    expect(peloServidor.error?.message).toMatch(/Funcionário ativo do Simples Nacional/);
    expect((await responsavelDe(clienteId))?.responsavel_id).toBe(dono.id);
  });

  // Desativação segura o perfil FOR UPDATE e o trigger de elegibilidade lê FOR SHARE:
  // a atribuição concorrente espera e reavalia. A promoção (ponto C) usa o mesmo
  // mecanismo; o Setor SN já tem Líder, então a corrida testável é com a desativação.
  it("desativação e reatribuição concorrentes nunca deixam um inativo como Responsável", async () => {
    for (let rodada = 0; rodada < 5; rodada++) {
      const alvo = await criarFuncionarioSN();
      const dono = await criarFuncionarioSN();
      const clienteId = await criarCliente(dono.id);

      await Promise.all([
        desativacao.desativar(alvo.id, ADMIN_ID),
        admin
          .from("cliente_cadastro_operacional_sn")
          .update({ responsavel_id: alvo.id })
          .eq("cliente_id", clienteId),
      ]);

      const perfil = (await admin.from("perfis").select("desativado_em").eq("id", alvo.id).single())
        .data;
      const responsavel = (await responsavelDe(clienteId))?.responsavel_id;
      expect(perfil?.desativado_em).not.toBeNull();
      expect(responsavel).not.toBe(alvo.id);
    }
  });
});

describe("promoção de Funcionário Responsável (ponto C)", () => {
  const alteracao = new SupabaseAlteracaoPapelGateway(admin);

  it("recusa enquanto houver Cliente atribuído, sem mutação parcial nem auditoria; libera depois de redistribuir", async () => {
    const funcionario = await criarFuncionarioSN();
    // O seed já tem Líder no SN: a promoção só prova a regra do Responsável se o
    // Setor estiver livre, então o Funcionário muda de Setor depois de atribuído.
    const clienteId = await criarCliente(funcionario.id);
    await admin.from("perfis").update({ setor: "recepcao" }).eq("id", funcionario.id);

    const recusada = await alteracao.alterar(funcionario.id, ADMIN_ID, "lider_setor");

    expect(recusada.ok).toBe(false);
    if (!recusada.ok) expect(recusada.error.message).toMatch(/Responsável por Clientes/);
    expect(
      (await admin.from("perfis").select("papel").eq("id", funcionario.id).single()).data,
    ).toEqual({ papel: "funcionario" });
    expect(
      (await admin.from("registros_auditoria").select("id").eq("alvo", funcionario.email)).data,
    ).toEqual([]);

    await admin
      .from("cliente_cadastro_operacional_sn")
      .update({ responsavel_id: null })
      .eq("cliente_id", clienteId);

    expect((await alteracao.alterar(funcionario.id, ADMIN_ID, "lider_setor")).ok).toBe(true);
  });
});
