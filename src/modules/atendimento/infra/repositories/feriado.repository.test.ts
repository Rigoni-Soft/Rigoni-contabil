/**
 * Integração infra ↔ Supabase (testes.md, seção 3) dos feriados do Admin.
 * Requer `npx supabase start` local com migrations + seed aplicados.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { SupabaseFeriadoRepository } from "./feriado.repository";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const service = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const DATA = "2031-03-17";
const OUTRA = "2031-03-18";

async function logadoComo(email: string, password: string): Promise<SupabaseClient> {
  const supabase = createClient(SUPABASE_URL, ANON_KEY);
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Falha ao autenticar ${email}: ${error.message}`);
  return supabase;
}

const auditoriaDe = async (acao: string, alvo: string) =>
  (
    await service
      .from("registros_auditoria")
      .select("ator, resultado")
      .eq("acao", acao)
      .eq("alvo", alvo)
  ).data ?? [];

let admin: SupabaseFeriadoRepository;
let funcionario: SupabaseFeriadoRepository;

beforeAll(async () => {
  admin = new SupabaseFeriadoRepository(await logadoComo("admin@rigonicontabil.local", "admin123"));
  funcionario = new SupabaseFeriadoRepository(
    await logadoComo("funcionario.sn@rigonicontabil.local", "func123"),
  );
});

afterEach(async () => {
  await service.from("feriados").delete().in("data", [DATA, OUTRA]);
  await service.from("registros_auditoria").delete().in("alvo", [DATA, OUTRA]);
});

// Admin com senha provisória ainda válida e troca obrigatória pendente:
// `meu_papel()` sozinho o deixava passar; as policies exigem `acesso_liberado()`.
async function criarAdminEmPrimeiroAcesso(): Promise<{ id: string; email: string }> {
  const email = `teste-feriados-${crypto.randomUUID()}@rigonicontabil.local`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password: "senha-provisoria-123",
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`Falha ao criar conta de teste: ${error?.message}`);
  const { error: erroPerfil } = await service.from("perfis").insert({
    id: data.user.id,
    nome: "Admin Primeiro Acesso",
    email,
    papel: "admin",
    setor: "administrativo",
    senha_trocada_em: null,
    senha_provisoria_expira_em: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
  });
  if (erroPerfil) throw new Error(`Falha ao salvar perfil de teste: ${erroPerfil.message}`);
  return { id: data.user.id, email };
}

describe("SupabaseFeriadoRepository", () => {
  it("Admin cadastra, lista e remove; cada ação fica na auditoria", async () => {
    expect((await admin.cadastrar({ data: DATA, descricao: "Aniversário da cidade" })).ok).toBe(
      true,
    );
    const lista = await admin.listar();
    expect(lista.ok && lista.value).toContainEqual({
      data: DATA,
      descricao: "Aniversário da cidade",
    });
    expect(await auditoriaDe("feriado.cadastrar", DATA)).toEqual([
      { ator: "11111111-1111-1111-1111-111111111111", resultado: "sucesso" },
    ]);

    expect((await admin.remover(DATA)).ok).toBe(true);
    expect(await auditoriaDe("feriado.remover", DATA)).toHaveLength(1);
  });

  it("data repetida e remoção de data sem feriado voltam como erro", async () => {
    await admin.cadastrar({ data: DATA, descricao: "A" });
    expect(await admin.cadastrar({ data: DATA, descricao: "B" })).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "VALIDATION_ERROR" }),
    });
    expect(await admin.remover(OUTRA)).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "NOT_FOUND" }),
    });
  });

  it("quem não é Admin não cadastra nem remove (RLS) e a URA lê as datas pelo service_role", async () => {
    expect((await funcionario.cadastrar({ data: OUTRA, descricao: "X" })).ok).toBe(false);
    await service.from("feriados").insert({ data: DATA, descricao: "Y" });
    expect(await funcionario.remover(DATA)).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "NOT_FOUND" }),
    });
    expect(await auditoriaDe("feriado.remover", DATA)).toHaveLength(0);

    const pelaUra = await new SupabaseFeriadoRepository(service).listarDatas();
    expect(pelaUra.ok && pelaUra.value).toContain(DATA);
  });

  it("Admin em primeiro acesso não lê, cadastra nem remove feriado; após a troca, sim", async () => {
    const conta = await criarAdminEmPrimeiroAcesso();
    try {
      await service.from("feriados").insert({ data: DATA, descricao: "Y" });
      const repo = new SupabaseFeriadoRepository(
        await logadoComo(conta.email, "senha-provisoria-123"),
      );

      const lista = await repo.listar();
      expect(lista.ok && lista.value).toEqual([]);
      expect((await repo.cadastrar({ data: OUTRA, descricao: "X" })).ok).toBe(false);
      expect((await repo.remover(DATA)).ok).toBe(false);
      const restantes = await service.from("feriados").select("data").in("data", [DATA, OUTRA]);
      expect(restantes.data).toEqual([{ data: DATA }]);

      await service
        .from("perfis")
        .update({ senha_trocada_em: new Date().toISOString() })
        .eq("id", conta.id);
      expect((await repo.cadastrar({ data: OUTRA, descricao: "X" })).ok).toBe(true);
      const aposTroca = await repo.listar();
      expect(aposTroca.ok && aposTroca.value.map((f) => f.data)).toEqual([DATA, OUTRA]);
    } finally {
      await service.from("registros_auditoria").delete().eq("ator", conta.id);
      await service.from("perfis").delete().eq("id", conta.id);
      await service.auth.admin.deleteUser(conta.id);
    }
  });
});
