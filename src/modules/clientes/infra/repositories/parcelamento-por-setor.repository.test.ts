/**
 * Integração infra ↔ Supabase: Parcelamento por Setor. Cada Setor tem os seus Parcelamentos e só vê
 * os seus; o Admin vê todos; salvar mexe só no Setor informado. Requer `npx supabase start` com
 * migrations + seed aplicados.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { removerClientesDeTeste } from "../../../../../test-support/clientes-de-teste";
import { SupabaseClienteParcelamentoRepository } from "./cliente-parcelamento.repository";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const CNPJ = "11444777009900";
const FUNCIONARIO_SN_ID = "22222222-2222-2222-2222-222222222222";
const FUNCIONARIO_FINANCEIRO_ID = "33333333-3333-3333-3333-333333333333";

async function entrar(email: string, senha: string): Promise<SupabaseClient> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) throw new Error(`Falha ao autenticar ${email}: ${error.message}`);
  return supabase;
}

const servico = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const comoAdmin = () => entrar("admin@rigonicontabil.local", "admin123");
const comoFuncionarioSN = () => entrar("funcionario.sn@rigonicontabil.local", "func123");
const comoFuncionarioFinanceiro = () =>
  entrar("funcionario.financeiro@rigonicontabil.local", "func123");

let clienteId: string;

const codigosVistos = async (supabase: SupabaseClient) =>
  (
    (await supabase.from("cliente_parcelamentos").select("codigo").eq("cliente_id", clienteId))
      .data ?? []
  )
    .map((linha) => linha.codigo as string)
    .sort();

beforeAll(async () => {
  await removerClientesDeTeste([CNPJ]);
  clienteId = crypto.randomUUID();
  const cliente = await servico.from("clientes").insert({
    id: clienteId,
    empresa: "Parcelamento Por Setor Ltda",
    cnpj: CNPJ,
    regime: "lucro_presumido",
  });
  if (cliente.error) throw cliente.error;
  const responsaveis = await servico.from("cliente_responsaveis").insert([
    { cliente_id: clienteId, setor: "simples_nacional", responsavel_id: FUNCIONARIO_SN_ID },
    { cliente_id: clienteId, setor: "financeiro", responsavel_id: FUNCIONARIO_FINANCEIRO_ID },
  ]);
  if (responsaveis.error) throw responsaveis.error;
  const parcelamentos = await servico.from("cliente_parcelamentos").insert(
    (["simples_nacional", "financeiro"] as const).map((setor) => {
      const id = crypto.randomUUID();
      return {
        id,
        cliente_id: clienteId,
        setor,
        codigo: setor === "financeiro" ? "FIN-1" : "SN-1",
        parcelas_restantes: 5,
        arquivo_caminho: `${clienteId}/${id}-acordo.pdf`,
      };
    }),
  );
  if (parcelamentos.error) throw parcelamentos.error;
});

afterAll(async () => {
  await removerClientesDeTeste([CNPJ]);
});

describe("Parcelamento por Setor (integração)", () => {
  it("cada Setor vê só os seus; o Admin vê todos; quem não é Responsável não vê nenhum", async () => {
    expect(await codigosVistos(await comoFuncionarioSN())).toEqual(["SN-1"]);
    expect(await codigosVistos(await comoFuncionarioFinanceiro())).toEqual(["FIN-1"]);
    expect(await codigosVistos(await comoAdmin())).toEqual(["FIN-1", "SN-1"]);
    expect(
      await codigosVistos(await entrar("funcionario2.sn@rigonicontabil.local", "func123")),
    ).toEqual([]);
  });

  it("salvar vazio num Setor remove só os Parcelamentos dele", async () => {
    const financeiro = new SupabaseClienteParcelamentoRepository(await comoFuncionarioFinanceiro());

    const r = await financeiro.salvar(clienteId, "financeiro", []);

    expect(r.ok).toBe(true);
    expect(await codigosVistos(servico)).toEqual(["SN-1"]);
  });

  it("o Funcionário de um Setor não grava nos Parcelamentos de outro", async () => {
    const financeiro = new SupabaseClienteParcelamentoRepository(await comoFuncionarioFinanceiro());
    const id = crypto.randomUUID();

    const r = await financeiro.salvar(clienteId, "simples_nacional", [
      {
        id,
        codigo: "INTRUSO",
        parcelasRestantes: 3,
        interno: false,
        arquivoCaminho: `${clienteId}/${id}-acordo.pdf`,
      },
    ]);

    expect(r.ok).toBe(false);
    expect(await codigosVistos(servico)).toEqual(["SN-1"]);
  });
});
