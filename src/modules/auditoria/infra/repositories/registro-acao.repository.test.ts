/**
 * Integração infra ↔ Supabase (testes.md, seção 3): requer `npx supabase start`
 * rodando localmente com as migrations e o seed aplicados.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { RegistroAcao } from "@/modules/auditoria/domain/entities/registro-acao.entity";

import { SupabaseRegistroAcaoRepository } from "./registro-acao.repository";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

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
  it("salva um registro em nome do próprio ator (RPC registrar_acao_auditoria)", async () => {
    const supabase = await clienteAutenticadoComoAdminSeed();
    const repositorio = new SupabaseRegistroAcaoRepository(supabase);

    const resultado = await repositorio.salvar(registroValido(crypto.randomUUID(), ADMIN_ID));

    expect(resultado.ok).toBe(true);
  });

  // Devolutiva técnica PR #60, bloqueador 01 — caminho legítimo: mesmo que o
  // domínio monte o RegistroAcao com um `ator` diferente (ex.: um bug ou uma
  // tentativa de manipulação antes de chegar no repositório), a RPC ignora
  // esse valor e grava sempre o auth.uid() de quem está autenticado de
  // verdade. Não é mais "RLS rejeita" — é "o valor forjado nem chega a ser
  // usado".
  it("grava sempre o ator autenticado de verdade, mesmo se o RegistroAcao carregar outro id (RPC ignora o ator do chamador)", async () => {
    const supabase = await clienteAutenticadoComoFuncionarioSeed();
    const repositorio = new SupabaseRegistroAcaoRepository(supabase);
    const id = crypto.randomUUID();

    const resultado = await repositorio.salvar(registroValido(id, ADMIN_ID));

    expect(resultado.ok).toBe(true);
    const admin = await clienteAutenticadoComoAdminSeed();
    const { data } = await admin.from("registros_auditoria").select("ator").eq("id", id).single();
    expect(data?.ator).toBe(FUNCIONARIO_ID);
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
    const supabase = await clienteAutenticadoComoAdminSeed();
    const repositorio = new SupabaseRegistroAcaoRepository(supabase);
    await repositorio.salvar(
      registroValido(crypto.randomUUID(), ADMIN_ID, {
        setor: "financeiro",
        acao: "cliente.editar",
        resultado: "falha",
      }),
    );

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
