/**
 * Integração Supabase: o repositório dos tipos de envio do contato (o que o Setor de quem chama envia a
 * ele). Requer `npx supabase start` com migrations + seed aplicados. Dados fictícios (LGPD).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { removerClientesDeTeste } from "../../../../../test-support/clientes-de-teste";
import { SupabaseTiposDeEnvioDoContatoRepository } from "./tipos-de-envio-do-contato.repository";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const CNPJ = "11444777009870";
const FUNCIONARIO_SN_ID = "22222222-2222-2222-2222-222222222222";

async function entrar(email: string, senha: string): Promise<SupabaseClient> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) throw new Error(`Falha ao autenticar ${email}: ${error.message}`);
  return supabase;
}

const servico = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const repositorioDe = async (email: string) =>
  new SupabaseTiposDeEnvioDoContatoRepository(await entrar(email, "func123"), {
    registrar: () => undefined,
  });

let clienteId: string;
let contatoId: string;

beforeAll(async () => {
  await removerClientesDeTeste([CNPJ]);
  clienteId = crypto.randomUUID();
  contatoId = crypto.randomUUID();
  const cliente = await servico.from("clientes").insert({
    id: clienteId,
    empresa: "Tipos de envio Ltda",
    cnpj: CNPJ,
    regime: "simples_nacional",
  });
  if (cliente.error) throw cliente.error;
  const responsavel = await servico.from("cliente_responsaveis").insert({
    cliente_id: clienteId,
    setor: "simples_nacional",
    responsavel_id: FUNCIONARIO_SN_ID,
  });
  if (responsavel.error) throw responsavel.error;
  const contato = await servico.from("cliente_contatos").insert({
    id: contatoId,
    cliente_id: clienteId,
    nome: "Eva Exemplo",
    telefone: "11977770000",
    dono_setor: "simples_nacional",
  });
  if (contato.error) throw contato.error;
});

beforeEach(async () => {
  await servico.from("destinos_de_envio").delete().eq("cliente_id", clienteId);
});

afterAll(async () => {
  await removerClientesDeTeste([CNPJ]);
});

const tiposGravados = async () => {
  const { data } = await servico
    .from("destinos_de_envio")
    .select("tipo")
    .eq("cliente_id", clienteId)
    .order("tipo", { nullsFirst: true });
  return data?.map((d) => d.tipo);
};

describe("SupabaseTiposDeEnvioDoContatoRepository (integração)", () => {
  it("define e redefine os tipos do contato pelo Setor de quem chama", async () => {
    const sn = await repositorioDe("funcionario.sn@rigonicontabil.local");

    const primeiro = await sn.definir(clienteId, contatoId, ["das", "todos"]);
    const segundo = await sn.definir(clienteId, contatoId, ["avisos"]);

    expect(primeiro.ok).toBe(true);
    expect(segundo.ok).toBe(true);
    expect(await tiposGravados()).toEqual(["avisos"]);
  });

  it("quem não gere o Cliente no Setor é recusado, sem gravar", async () => {
    const rh = await repositorioDe("funcionario.rh@rigonicontabil.local");

    const r = await rh.definir(clienteId, contatoId, ["avisos"]);

    expect(r.ok).toBe(false);
    expect(await tiposGravados()).toEqual([]);
  });

  it("tipo fora do catálogo do Setor vira erro de validação", async () => {
    const sn = await repositorioDe("funcionario.sn@rigonicontabil.local");

    const r = await sn.definir(clienteId, contatoId, ["inexistente"]);

    expect(r.ok).toBe(false);
    expect(await tiposGravados()).toEqual([]);
  });
});
