/**
 * Integração Supabase: o repositório dos Destinos de envio (definir e remover pelo Setor de quem chama).
 * Requer `npx supabase start` com migrations + seed aplicados. Dados fictícios (LGPD).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { DestinoDeEnvio } from "@/modules/clientes/domain/value-objects/destino-de-envio.vo";

import { removerClientesDeTeste } from "../../../../../test-support/clientes-de-teste";
import { SupabaseDestinoDeEnvioRepository } from "./destino-de-envio.repository";

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
const comoSN = async () =>
  new SupabaseDestinoDeEnvioRepository(
    await entrar("funcionario.sn@rigonicontabil.local", "func123"),
    { registrar: () => undefined },
  );
const comoRH = async () =>
  new SupabaseDestinoDeEnvioRepository(
    await entrar("funcionario.rh@rigonicontabil.local", "func123"),
    { registrar: () => undefined },
  );

let clienteId: string;

const destinoNovo = (telefone: string, tipo: string | null = null) => {
  const criado = DestinoDeEnvio.criar({
    contato: { novo: { nome: "Eva Exemplo", telefone, email: "" } },
    tipo,
    canal: "whatsapp",
  });
  if (!criado.ok) throw criado.error;
  return criado.value;
};

beforeAll(async () => {
  await removerClientesDeTeste([CNPJ]);
  clienteId = crypto.randomUUID();
  const cliente = await servico.from("clientes").insert({
    id: clienteId,
    empresa: "Repositório Destinos Ltda",
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
});

beforeEach(async () => {
  await servico.from("destinos_de_envio").delete().eq("cliente_id", clienteId);
  await servico.from("cliente_contatos").delete().eq("cliente_id", clienteId);
});

afterAll(async () => {
  await removerClientesDeTeste([CNPJ]);
});

describe("SupabaseDestinoDeEnvioRepository (integração)", () => {
  it("define o Destino com contato novo e devolve os ids; remover apaga o Destino", async () => {
    const sn = await comoSN();

    const definido = await sn.definir(clienteId, destinoNovo("11977770000", "das"));

    expect(definido.ok).toBe(true);
    if (!definido.ok) return;
    const gravado = await servico
      .from("destinos_de_envio")
      .select("id, contato_id, tipo")
      .eq("cliente_id", clienteId);
    expect(gravado.data).toEqual([
      { id: definido.value.destinoId, contato_id: definido.value.contatoId, tipo: "das" },
    ]);

    const removido = await sn.remover(definido.value.destinoId);

    expect(removido.ok).toBe(true);
    const depois = await servico.from("destinos_de_envio").select("id").eq("cliente_id", clienteId);
    expect(depois.data).toEqual([]);
  });

  it("o mesmo número do Cliente recusa o contato novo e aponta o existente", async () => {
    const sn = await comoSN();
    await sn.definir(clienteId, destinoNovo("11977770000"));

    const repetido = await sn.definir(clienteId, destinoNovo("(11) 97777-0000"));

    expect(repetido.ok).toBe(false);
    if (!repetido.ok) expect(repetido.error.message).toContain("Eva Exemplo");
  });

  it("o mesmo Destino repetido é recusado com texto próprio", async () => {
    const sn = await comoSN();
    const primeiro = await sn.definir(clienteId, destinoNovo("11977770000"));
    if (!primeiro.ok) throw primeiro.error;
    const igual = DestinoDeEnvio.criar({
      contato: { id: primeiro.value.contatoId },
      tipo: null,
      canal: "whatsapp",
    });
    if (!igual.ok) throw igual.error;

    const repetido = await sn.definir(clienteId, igual.value);

    expect(!repetido.ok && repetido.error.message).toBe(
      "Este contato já está definido para este tipo de envio.",
    );
  });

  it("quem não gere o Cliente no Setor é recusado, ao definir e ao remover", async () => {
    const sn = await comoSN();
    const definido = await sn.definir(clienteId, destinoNovo("11977770000"));
    if (!definido.ok) throw definido.error;
    const rh = await comoRH();

    const definirNoRh = await rh.definir(clienteId, destinoNovo("11966660000"));
    const removerDoSn = await rh.remover(definido.value.destinoId);

    expect(definirNoRh.ok).toBe(false);
    expect(removerDoSn.ok).toBe(false);
    const sobrou = await servico.from("destinos_de_envio").select("id").eq("cliente_id", clienteId);
    expect(sobrou.data).toHaveLength(1);
  });
});
