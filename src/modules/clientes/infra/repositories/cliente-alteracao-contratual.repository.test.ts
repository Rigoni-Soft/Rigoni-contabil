/**
 * Integração infra ↔ Supabase para anexar alteração contratual a Cliente existente (#141, S2e).
 * Requer `npx supabase start` local com migrations + seed aplicados.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { AlteracaoContratual } from "@/modules/clientes/domain/value-objects/alteracao-contratual.vo";

import { criarAdminLocal } from "../../../../../test-support/admin-supabase-local";
import { removerClientesDeTeste } from "../../../../../test-support/clientes-de-teste";
import { SupabaseClienteRepository } from "./cliente.repository";

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

const ADMIN_ID = "11111111-1111-1111-1111-111111111111";
const CNPJ = "11222333000181";
const CNPJ_COM_ALTERACAO = "11444777000161";
const clienteId = crypto.randomUUID();
const clienteComAlteracaoId = crypto.randomUUID();

function alteracao(numero: number, data = "2025-03-10") {
  const criada = AlteracaoContratual.criar(
    numero,
    data,
    `${clienteId}/alteracoes-contratuais/${numero}-alteracao.pdf`,
  );
  if (!criada.ok) throw new Error("setup inválido");
  return criada.value;
}

async function eventosDeAnexar(cnpj: string) {
  const { data } = await servico
    .from("registros_auditoria")
    .select("ator, setor, acao, alvo, resultado")
    .like("alvo", `${cnpj}%`)
    .eq("acao", "cliente.anexar-alteracao");
  return data ?? [];
}

beforeAll(async () => {
  await removerClientesDeTeste([CNPJ, CNPJ_COM_ALTERACAO]);
  for (const [id, cnpj, alteracoes] of [
    [clienteId, CNPJ, []],
    [
      clienteComAlteracaoId,
      CNPJ_COM_ALTERACAO,
      [
        {
          id: crypto.randomUUID(),
          numero: 1,
          data: "2024-01-10",
          arquivoCaminho: `${clienteComAlteracaoId}/alteracoes-contratuais/1-a.pdf`,
        },
      ],
    ],
  ] as const) {
    const criado = await servico.rpc("criar_cliente", {
      p_id: id,
      p_empresa: "Anexar Alteração Ltda",
      p_cnpj: cnpj,
      p_regime: "simples_nacional",
      p_contrato_social_caminho: null,
      p_alteracoes: alteracoes,
    });
    if (criado.error) throw new Error(`setup: ${criado.error.message}`);
  }
});

afterAll(async () => {
  await removerClientesDeTeste([CNPJ, CNPJ_COM_ALTERACAO]);
});

describe("SupabaseClienteRepository.anexarAlteracaoContratual", () => {
  it("Admin anexa a alteração, que fica gravada e auditada com ator e setor da sessão", async () => {
    const admin = await como("admin@rigonicontabil.local", "admin123");

    const resultado = await new SupabaseClienteRepository(admin).anexarAlteracaoContratual(
      clienteId,
      alteracao(2),
    );

    expect(resultado.ok).toBe(true);
    const { data } = await servico
      .from("cliente_alteracoes_contratuais")
      .select("numero, data, arquivo_caminho")
      .eq("cliente_id", clienteId);
    expect(data).toEqual([
      {
        numero: 2,
        data: "2025-03-10",
        arquivo_caminho: `${clienteId}/alteracoes-contratuais/2-alteracao.pdf`,
      },
    ]);
    expect(await eventosDeAnexar(CNPJ)).toEqual([
      {
        ator: ADMIN_ID,
        setor: "administrativo",
        acao: "cliente.anexar-alteracao",
        alvo: `${CNPJ} - alteração nº 2`,
        resultado: "sucesso",
      },
    ]);
  });

  it.each([
    ["Líder do Setor", "lider.sn@rigonicontabil.local", "lider123"],
    ["Funcionário", "funcionario.sn@rigonicontabil.local", "func123"],
  ])("%s é recusado e nada é gravado", async (_papel, email, senha) => {
    const sessao = await como(email, senha);

    const resultado = await new SupabaseClienteRepository(sessao).anexarAlteracaoContratual(
      clienteId,
      alteracao(7),
    );

    expect(resultado.ok).toBe(false);
    const { data } = await servico
      .from("cliente_alteracoes_contratuais")
      .select("numero")
      .eq("cliente_id", clienteId)
      .eq("numero", 7);
    expect(data).toEqual([]);
  });

  it("nº repetido no mesmo Cliente vira 'Já existe a alteração nº N deste Cliente'", async () => {
    const admin = await como("admin@rigonicontabil.local", "admin123");

    const resultado = await new SupabaseClienteRepository(admin).anexarAlteracaoContratual(
      clienteComAlteracaoId,
      alteracao(1),
    );

    expect(resultado).toMatchObject({
      ok: false,
      error: { message: "Já existe a alteração nº 1 deste Cliente." },
    });
    expect(await eventosDeAnexar(CNPJ_COM_ALTERACAO)).toEqual([]);
  });

  it("a criação do Cliente com alterações não gera o evento de anexar", async () => {
    expect(await eventosDeAnexar(CNPJ_COM_ALTERACAO)).toEqual([]);
  });
});
