/**
 * Integração infra ↔ Supabase para o gateway dos Avisos de cadastro (#142, S5a).
 * Requer `npx supabase start` local com migrations + seed aplicados.
 */
import { createClient } from "@supabase/supabase-js";

import { criarAdminLocal } from "../../../../../test-support/admin-supabase-local";
import {
  criarClienteDeTeste,
  removerClientesDeTeste,
} from "../../../../../test-support/clientes-de-teste";
import { SupabaseAvisosCadastroGateway } from "./avisos-cadastro.gateway";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const CNPJ = "11222333000181";
let clienteId: string;

let gateway: SupabaseAvisosCadastroGateway;

beforeAll(async () => {
  await removerClientesDeTeste([CNPJ]);
  clienteId = await criarClienteDeTeste(CNPJ, "simples_nacional");
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const login = await supabase.auth.signInWithPassword({
    email: "lider.sn@rigonicontabil.local",
    password: "lider123",
  });
  if (login.error) throw new Error(login.error.message);
  gateway = new SupabaseAvisosCadastroGateway(supabase);
});

afterAll(() => removerClientesDeTeste([CNPJ]));

describe("SupabaseAvisosCadastroGateway (#142, integração)", () => {
  it("lista mapeando a linha para o DTO, sem expor nomes de coluna do banco", async () => {
    const resultado = await gateway.listar(null, 31);

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.value).toContainEqual({
      id: expect.any(String),
      tipo: "novo_cliente",
      clienteId,
      alteracaoId: null,
      alteracaoNumero: null,
      criadoEm: expect.any(String),
      vistoEm: null,
    });
  });

  it("aviso de nova alteração chega ao Líder com o id e o nº da alteração (#144)", async () => {
    const alteracaoId = crypto.randomUUID();
    const admin = criarAdminLocal(SERVICE_KEY);
    const { error } = await admin.from("cliente_alteracoes_contratuais").insert({
      id: alteracaoId,
      cliente_id: clienteId,
      numero: 4,
      data: "2025-03-10",
      arquivo_caminho: `${clienteId}/alteracoes-contratuais/4-a.pdf`,
    });
    if (error) throw new Error(error.message);

    const resultado = await gateway.listar(null, 31);

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.value).toContainEqual({
      id: expect.any(String),
      tipo: "nova_alteracao",
      clienteId,
      alteracaoId,
      alteracaoNumero: 4,
      criadoEm: expect.any(String),
      vistoEm: null,
    });
  });

  it("conta os não vistos e marca como visto", async () => {
    const antes = await gateway.contarNaoVistos();
    const lista = await gateway.listar(null, 31);
    if (!antes.ok || !lista.ok) throw new Error("setup inválido");
    const alvo = lista.value.find((a) => a.clienteId === clienteId);
    if (!alvo) throw new Error("aviso do cenário não encontrado");

    const marcado = await gateway.marcarVisto(alvo.id);
    const depois = await gateway.contarNaoVistos();

    expect(marcado.ok).toBe(true);
    expect(depois).toEqual({ ok: true, value: antes.value - 1 });
  });
});
