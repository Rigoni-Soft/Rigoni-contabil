/**
 * Integração infra ↔ Supabase (testes.md, seção 3): requer `npx supabase start`
 * rodando localmente com as migrations e o seed aplicados.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { RegistroAcao } from "@/modules/auditoria/domain/entities/registro-acao.entity";

import { SupabaseRegistroAcaoRepository } from "./registro-acao.repository";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const ADMIN_ID = "11111111-1111-1111-1111-111111111111";
const FUNCIONARIO_ID = "22222222-2222-2222-2222-222222222222";

async function clienteAutenticadoComoAdminSeed(): Promise<SupabaseClient> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { error } = await supabase.auth.signInWithPassword({
    email: "admin@rigonicontabil.local",
    password: "admin123",
  });
  if (error) throw new Error(`Falha ao autenticar o admin do seed: ${error.message}`);
  return supabase;
}

async function clienteAutenticadoComoFuncionarioSeed(): Promise<SupabaseClient> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { error } = await supabase.auth.signInWithPassword({
    email: "funcionario.sn@rigonicontabil.local",
    password: "func123",
  });
  if (error) throw new Error(`Falha ao autenticar o funcionário do seed: ${error.message}`);
  return supabase;
}

// Devolutiva técnica PR #61, ponto 3: registrar_acao_auditoria só aceita
// service_role agora (migration 20260930170000) — mesmo client que
// `main/auditoria.factory.ts` usa de verdade em produção.
function clienteServiceRole(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

type RegistroOverrides = { setor?: string; acao?: string; resultado?: string };

function registroValido(id: string, ator: string, overrides: RegistroOverrides = {}) {
  const resultado = RegistroAcao.builder()
    .comId(id)
    .comAtor(ator)
    .comSetor(overrides.setor ?? "administrativo")
    .comAcao(overrides.acao ?? "usuario.criar")
    .comAlvo("usuário de teste")
    .comResultado(overrides.resultado ?? "sucesso")
    .comDataHora(new Date())
    .build();
  if (!resultado.ok) throw new Error("setup inválido");
  return resultado.value;
}

describe("SupabaseRegistroAcaoRepository (integração)", () => {
  it("salva um registro via service_role, com o ator explícito que o servidor já validou", async () => {
    const repositorio = new SupabaseRegistroAcaoRepository(clienteServiceRole());
    const id = crypto.randomUUID();

    const resultado = await repositorio.salvar(registroValido(id, ADMIN_ID));

    expect(resultado.ok).toBe(true);
    const admin = await clienteAutenticadoComoAdminSeed();
    const { data } = await admin.from("registros_auditoria").select("ator").eq("id", id).single();
    expect(data?.ator).toBe(ADMIN_ID);
  });

  // Devolutiva técnica PR #61, ponto 3 — fecha a brecha herdada da PR #60:
  // antes, um usuário autenticado comum ainda conseguia chamar a RPC direto
  // (fora da UI) e fabricar um evento em seu próprio nome, já que EXECUTE
  // estava liberado pra `authenticated`. Agora só `service_role` tem EXECUTE
  // — um usuário comum (mesmo o Admin, autenticado pela sessão normal, não
  // pelo client privilegiado) não consegue mais chamar a RPC de jeito nenhum.
  it("rejeita a chamada da RPC por um usuário autenticado comum (EXECUTE revogado, só service_role chama)", async () => {
    const supabase = await clienteAutenticadoComoFuncionarioSeed();
    const repositorio = new SupabaseRegistroAcaoRepository(supabase);

    const resultado = await repositorio.salvar(registroValido(crypto.randomUUID(), FUNCIONARIO_ID));

    expect(resultado.ok).toBe(false);
  });

  // Devolutiva técnica PR #60, bloqueador 01 — caminho indevido: sem policy
  // de INSERT na tabela, um usuário autenticado não consegue mais fabricar
  // um evento chamando a Data API diretamente (bypassando a RPC/a aplicação).
  it("rejeita insert direto na tabela via Data API, bypassando a RPC", async () => {
    const supabase = await clienteAutenticadoComoFuncionarioSeed();

    const { error } = await supabase.from("registros_auditoria").insert({
      id: crypto.randomUUID(),
      ator: FUNCIONARIO_ID,
      setor: "administrativo",
      acao: "usuario.criar",
      alvo: "evento forjado",
      resultado: "sucesso",
      criado_em: "2020-01-01T00:00:00.000Z",
    });

    expect(error).not.toBeNull();
  });

  it("Admin lista os registros recentes, incluindo o do seed (RLS: registros_auditoria_select_admin)", async () => {
    const supabase = await clienteAutenticadoComoAdminSeed();
    const repositorio = new SupabaseRegistroAcaoRepository(supabase);

    const registros = await repositorio.listar({ limite: 50 });

    expect(registros.ok).toBe(true);
    if (registros.ok) {
      expect(registros.value.some((r) => r.alvo === "funcionario.sn@rigonicontabil.local")).toBe(
        true,
      );
    }
  });

  it("Funcionário não vê nenhum registro (RLS: só Admin)", async () => {
    const supabase = await clienteAutenticadoComoFuncionarioSeed();
    const repositorio = new SupabaseRegistroAcaoRepository(supabase);

    const registros = await repositorio.listar({ limite: 50 });

    expect(registros.ok).toBe(true);
    if (registros.ok) expect(registros.value).toEqual([]);
  });

  it("filtra por setor, ação (busca parcial) e resultado", async () => {
    // salvar() precisa de service_role (ponto 3); listar() continua no client
    // da sessão do Admin (RLS de leitura não mudou).
    await new SupabaseRegistroAcaoRepository(clienteServiceRole()).salvar(
      registroValido(crypto.randomUUID(), ADMIN_ID, {
        setor: "financeiro",
        acao: "cliente.editar",
        resultado: "falha",
      }),
    );
    const supabase = await clienteAutenticadoComoAdminSeed();
    const repositorio = new SupabaseRegistroAcaoRepository(supabase);

    const porSetor = await repositorio.listar({ limite: 50, setor: "financeiro" });
    expect(porSetor.ok).toBe(true);
    if (porSetor.ok) {
      expect(porSetor.value.every((r) => r.setor === "financeiro")).toBe(true);
      expect(porSetor.value.length).toBeGreaterThan(0);
    }

    const porAcaoParcial = await repositorio.listar({ limite: 50, acao: "cliente" });
    expect(porAcaoParcial.ok).toBe(true);
    if (porAcaoParcial.ok) {
      expect(porAcaoParcial.value.some((r) => r.acao === "cliente.editar")).toBe(true);
    }

    const porResultado = await repositorio.listar({ limite: 50, resultado: "falha" });
    expect(porResultado.ok).toBe(true);
    if (porResultado.ok) {
      expect(porResultado.value.every((r) => r.resultado === "falha")).toBe(true);
      expect(porResultado.value.length).toBeGreaterThan(0);
    }
  });

  it("filtra por período (dataInicio/dataFim), excluindo o que está fora da janela", async () => {
    const supabase = await clienteAutenticadoComoAdminSeed();
    const repositorio = new SupabaseRegistroAcaoRepository(supabase);

    const registros = await repositorio.listar({
      limite: 50,
      dataInicio: "2099-01-01T00:00:00.000Z",
      dataFim: "2099-01-02T23:59:59.999Z",
    });

    expect(registros.ok).toBe(true);
    if (registros.ok) expect(registros.value).toEqual([]);
  });
});
