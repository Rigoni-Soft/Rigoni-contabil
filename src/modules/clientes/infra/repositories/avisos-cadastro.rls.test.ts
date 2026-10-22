/**
 * Integração infra ↔ Supabase para RLS, RPCs e lista dos Avisos de cadastro (#142, S3a–S3c).
 * Requer `npx supabase start` local com migrations + seed aplicados. Cada papel entra com a sessão real.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { criarAdminLocal } from "../../../../../test-support/admin-supabase-local";
import {
  criarClienteDeTeste,
  removerClientesDeTeste,
} from "../../../../../test-support/clientes-de-teste";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const servico = criarAdminLocal(SERVICE_KEY);

async function como(email: string, senha: string): Promise<SupabaseClient> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) throw new Error(`Falha ao autenticar ${email}: ${error.message}`);
  return supabase;
}

const LIDER_SN_ID = "88888888-8888-8888-8888-888888888888";
const CNPJ = "11222333000181";
let clienteId: string;

let lider: SupabaseClient;
let funcionario: SupabaseClient;
let admin: SupabaseClient;

async function avisosDoLider() {
  const { data, error } = await servico
    .from("avisos_cadastro")
    .select("id, visto_em")
    .eq("destinatario_id", LIDER_SN_ID)
    .eq("cliente_id", clienteId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function inserirAvisoDoLider(criadoEm: string, vistoEm: string | null = null) {
  const id = crypto.randomUUID();
  const { error } = await servico.from("avisos_cadastro").insert({
    id,
    destinatario_id: LIDER_SN_ID,
    tipo: "novo_cliente",
    cliente_id: clienteId,
    criado_em: criadoEm,
    visto_em: vistoEm,
  });
  if (error) throw new Error(error.message);
  return id;
}

beforeAll(async () => {
  await removerClientesDeTeste([CNPJ]);
  clienteId = await criarClienteDeTeste(CNPJ, "simples_nacional");
  [lider, funcionario, admin] = await Promise.all([
    como("lider.sn@rigonicontabil.local", "lider123"),
    como("funcionario.sn@rigonicontabil.local", "func123"),
    como("admin@rigonicontabil.local", "admin123"),
  ]);
});

afterAll(() => removerClientesDeTeste([CNPJ]));

describe("avisos_cadastro: RLS (#142, S3a)", () => {
  it("o destinatário lê as próprias linhas; outro papel, nenhuma", async () => {
    const doLider = await lider.from("avisos_cadastro").select("id").eq("cliente_id", clienteId);
    const doFuncionario = await funcionario
      .from("avisos_cadastro")
      .select("id")
      .eq("cliente_id", clienteId);
    const doAdmin = await admin.from("avisos_cadastro").select("id").eq("cliente_id", clienteId);

    expect(doLider.data).toHaveLength(1);
    expect(doFuncionario.data).toEqual([]);
    expect(doAdmin.data).toEqual([]);
  });

  it("authenticated não escreve direto (INSERT, UPDATE, DELETE)", async () => {
    const [alvo] = await avisosDoLider();

    const insercao = await lider.from("avisos_cadastro").insert({
      destinatario_id: LIDER_SN_ID,
      tipo: "novo_cliente",
      cliente_id: clienteId,
    });
    const atualizacao = await lider
      .from("avisos_cadastro")
      .update({ visto_em: new Date().toISOString() })
      .eq("id", alvo.id);
    const remocao = await lider.from("avisos_cadastro").delete().eq("id", alvo.id);

    expect(insercao.error).not.toBeNull();
    expect(atualizacao.error).not.toBeNull();
    expect(remocao.error).not.toBeNull();
    expect(await avisosDoLider()).toEqual([alvo]);
  });

  it("anon não acessa a tabela", async () => {
    const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const { error } = await anon.from("avisos_cadastro").select("id").limit(1);

    expect(error).not.toBeNull();
  });
});

describe("marcar_aviso_visto (#142, S3b)", () => {
  it("marca o próprio e é idempotente (não reescreve visto_em)", async () => {
    const [alvo] = await avisosDoLider();

    const primeira = await lider.rpc("marcar_aviso_visto", { p_id: alvo.id });
    const [depoisDaPrimeira] = await avisosDoLider();
    const segunda = await lider.rpc("marcar_aviso_visto", { p_id: alvo.id });
    const [depoisDaSegunda] = await avisosDoLider();

    expect(primeira.error).toBeNull();
    expect(segunda.error).toBeNull();
    expect(depoisDaPrimeira.visto_em).not.toBeNull();
    expect(depoisDaSegunda.visto_em).toBe(depoisDaPrimeira.visto_em);
  });

  it("não marca o aviso de outra pessoa", async () => {
    const id = await inserirAvisoDoLider("2026-01-01T00:00:00Z");

    await funcionario.rpc("marcar_aviso_visto", { p_id: id });

    const { data } = await servico.from("avisos_cadastro").select("visto_em").eq("id", id);
    expect(data).toEqual([{ visto_em: null }]);
  });

  it("anon não executa a RPC", async () => {
    const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const { error } = await anon.rpc("marcar_aviso_visto", { p_id: crypto.randomUUID() });

    expect(error).not.toBeNull();
  });
});

type LinhaLista = { id: string; criado_em: string; visto_em: string | null };

describe("listar_avisos_cadastro e contador (#142, S3c)", () => {
  beforeAll(async () => {
    // A lista é do usuário inteiro: sobras de outras suítes e do seed mudariam a ordem esperada.
    // Avisos são derivados (gatilho) e só do Supabase local, então o Líder do SN começa vazio aqui.
    await servico.from("avisos_cadastro").delete().eq("destinatario_id", LIDER_SN_ID);
    // 35 não vistos (um por minuto) e 2 vistos, um deles o mais novo de todos.
    for (let i = 0; i < 35; i++) {
      await inserirAvisoDoLider(`2026-02-01T10:${String(i).padStart(2, "0")}:00Z`);
    }
    await inserirAvisoDoLider("2026-03-01T00:00:00Z", "2026-03-02T00:00:00Z");
    await inserirAvisoDoLider("2026-01-01T00:00:00Z", "2026-01-02T00:00:00Z");
  });

  it("não vistos primeiro, depois criado_em decrescente, 30 por página", async () => {
    const { data, error } = await lider.rpc("listar_avisos_cadastro", { p_limite: 30 });
    const linhas = data as LinhaLista[];

    expect(error).toBeNull();
    expect(linhas).toHaveLength(30);
    expect(linhas.every((a) => a.visto_em === null)).toBe(true);
    expect(linhas[0].criado_em).toBe("2026-02-01T10:34:00+00:00");
    const datas = linhas.map((a) => a.criado_em);
    expect([...datas].sort().reverse()).toEqual(datas);
  });

  it("o cursor continua de onde parou: 5 não vistos, depois os 2 vistos", async () => {
    const primeira = await lider.rpc("listar_avisos_cadastro", { p_limite: 30 });
    const ultimo = (primeira.data as LinhaLista[])[29];

    const segunda = await lider.rpc("listar_avisos_cadastro", {
      p_limite: 30,
      p_cursor_visto: ultimo.visto_em !== null,
      p_cursor_criado_em: ultimo.criado_em,
      p_cursor_id: ultimo.id,
    });
    const linhas = segunda.data as LinhaLista[];

    expect(segunda.error).toBeNull();
    expect(linhas.map((a) => a.visto_em !== null)).toEqual([
      false,
      false,
      false,
      false,
      false,
      true,
      true,
    ]);
    expect(linhas[5].criado_em).toBe("2026-03-01T00:00:00+00:00");
  });

  it("lista só as próprias linhas", async () => {
    const { data } = await funcionario.rpc("listar_avisos_cadastro", { p_limite: 30 });

    expect(data).toEqual([]);
  });

  it("conta só os não vistos do usuário", async () => {
    const { count } = await lider
      .from("avisos_cadastro")
      .select("id", { count: "exact", head: true })
      .is("visto_em", null);

    expect(count).toBeGreaterThanOrEqual(35);
  });
});

describe("listar_avisos_cadastro: empate de criado_em (#142, S3c)", () => {
  it("o id desempata: três avisos no mesmo instante, em páginas de 2, sem pular nem repetir", async () => {
    await servico.from("avisos_cadastro").delete().eq("destinatario_id", LIDER_SN_ID);
    const instante = "2026-05-01T10:00:00.123456Z";
    const ids = await Promise.all([1, 2, 3].map(() => inserirAvisoDoLider(instante)));

    const primeira = await lider.rpc("listar_avisos_cadastro", { p_limite: 2 });
    const pagina1 = primeira.data as LinhaLista[];
    const ultimo = pagina1[1];
    const segunda = await lider.rpc("listar_avisos_cadastro", {
      p_limite: 2,
      p_cursor_visto: false,
      p_cursor_criado_em: ultimo.criado_em,
      p_cursor_id: ultimo.id,
    });
    const todos = [...pagina1, ...(segunda.data as LinhaLista[])].map((a) => a.id);

    expect(todos).toHaveLength(3);
    expect([...todos].sort()).toEqual([...ids].sort());
  });
});

describe("auditoria (#142)", () => {
  it("marcar visto não grava em registros_auditoria", async () => {
    const id = await inserirAvisoDoLider("2026-04-01T00:00:00Z");
    const antes = await servico
      .from("registros_auditoria")
      .select("id", { count: "exact", head: true })
      .eq("ator", LIDER_SN_ID);

    await lider.rpc("marcar_aviso_visto", { p_id: id });

    const depois = await servico
      .from("registros_auditoria")
      .select("id", { count: "exact", head: true })
      .eq("ator", LIDER_SN_ID);
    expect(depois.count).toBe(antes.count);
  });
});
