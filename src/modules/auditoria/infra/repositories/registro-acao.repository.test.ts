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
    email: "funcionario@rigonicontabil.local",
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
  it("salva um registro em nome do próprio ator (RLS: registros_auditoria_insert_proprio_ator)", async () => {
    const supabase = await clienteAutenticadoComoAdminSeed();
    const repositorio = new SupabaseRegistroAcaoRepository(supabase);

    const resultado = await repositorio.salvar(registroValido(crypto.randomUUID(), ADMIN_ID));

    expect(resultado.ok).toBe(true);
  });

  it("rejeita salvar um registro em nome de outro ator (RLS)", async () => {
    const supabase = await clienteAutenticadoComoFuncionarioSeed();
    const repositorio = new SupabaseRegistroAcaoRepository(supabase);

    const resultado = await repositorio.salvar(registroValido(crypto.randomUUID(), ADMIN_ID));

    expect(resultado.ok).toBe(false);
  });

  it("Admin lista os registros recentes, incluindo o do seed (RLS: registros_auditoria_select_admin)", async () => {
    const supabase = await clienteAutenticadoComoAdminSeed();
    const repositorio = new SupabaseRegistroAcaoRepository(supabase);

    const registros = await repositorio.listar({ limite: 50 });

    expect(registros.some((r) => r.alvo === "funcionario@rigonicontabil.local")).toBe(true);
  });

  it("Funcionário não vê nenhum registro (RLS: só Admin)", async () => {
    const supabase = await clienteAutenticadoComoFuncionarioSeed();
    const repositorio = new SupabaseRegistroAcaoRepository(supabase);

    const registros = await repositorio.listar({ limite: 50 });

    expect(registros).toEqual([]);
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
    expect(porSetor.every((r) => r.setor === "financeiro")).toBe(true);
    expect(porSetor.length).toBeGreaterThan(0);

    const porAcaoParcial = await repositorio.listar({ limite: 50, acao: "cliente" });
    expect(porAcaoParcial.some((r) => r.acao === "cliente.editar")).toBe(true);

    const porResultado = await repositorio.listar({ limite: 50, resultado: "falha" });
    expect(porResultado.every((r) => r.resultado === "falha")).toBe(true);
    expect(porResultado.length).toBeGreaterThan(0);
  });

  it("filtra por período (dataInicio/dataFim), excluindo o que está fora da janela", async () => {
    const supabase = await clienteAutenticadoComoAdminSeed();
    const repositorio = new SupabaseRegistroAcaoRepository(supabase);

    const registros = await repositorio.listar({
      limite: 50,
      dataInicio: "2099-01-01T00:00:00.000Z",
      dataFim: "2099-01-02T23:59:59.999Z",
    });

    expect(registros).toEqual([]);
  });
});
