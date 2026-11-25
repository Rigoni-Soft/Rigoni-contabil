import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { SupabaseIdentificacaoContatoGateway } from "./supabase-identificacao-contato.gateway";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const gateway = new SupabaseIdentificacaoContatoGateway(admin);

const PADRAO = "(61) 99111-2233";
const OUTRO = "(61) 3222-4455";
const clienteId = crypto.randomUUID();
const COMPARTILHADO = "(61) 98777-6655";
const clienteA = crypto.randomUUID();
const clienteB = crypto.randomUUID();

beforeAll(async () => {
  const cliente = await admin.from("clientes").insert({
    id: clienteId,
    empresa: "Contato Teste Ltda",
    cnpj: `9${Date.now()}`.slice(0, 14),
    regime: "simples_nacional",
  });
  if (cliente.error) throw cliente.error;
  const contatos = await admin.from("cliente_contatos").insert([
    { id: crypto.randomUUID(), cliente_id: clienteId, nome: "Bia", telefone: PADRAO, email: "" },
    {
      id: crypto.randomUUID(),
      cliente_id: clienteId,
      nome: "Caio",
      telefone: OUTRO,
    },
  ]);
  if (contatos.error) throw contatos.error;
  for (const [id, empresa, cnpj] of [
    [clienteA, "Empresa A Ltda", `8${Date.now()}`.slice(0, 14)],
    [clienteB, "Empresa B Ltda", `7${Date.now()}`.slice(0, 14)],
  ]) {
    const novo = await admin
      .from("clientes")
      .insert({ id, empresa, cnpj, regime: "simples_nacional" });
    if (novo.error) throw novo.error;
    const contato = await admin.from("cliente_contatos").insert({
      id: crypto.randomUUID(),
      cliente_id: id,
      nome: `Contato ${empresa}`,
      telefone: COMPARTILHADO,
    });
    if (contato.error) throw contato.error;
  }
});

afterAll(async () => {
  await admin.from("clientes").delete().in("id", [clienteId, clienteA, clienteB]);
});

describe("SupabaseIdentificacaoContatoGateway", () => {
  it("identifica o contato pelos dígitos do telefone", async () => {
    const r = await gateway.identificar("61991112233");
    expect(r).toEqual({
      ok: true,
      value: { clienteId, nome: "Bia", empresa: "Contato Teste Ltda" },
    });
  });

  it("identifica qualquer contato do Cliente, de qualquer Setor dono", async () => {
    const r = await gateway.identificar("6132224455");
    expect(r).toEqual({
      ok: true,
      value: { clienteId, nome: "Caio", empresa: "Contato Teste Ltda" },
    });
  });

  it("mesmo telefone em dois Clientes é ambíguo: nenhum é escolhido", async () => {
    expect(await gateway.identificar("61987776655")).toEqual({ ok: true, value: "ambiguo" });
  });

  it("número que não é de nenhum Cliente devolve null", async () => {
    expect(await gateway.identificar("61900000000")).toEqual({ ok: true, value: null });
  });

  it("cnpjCadastrado acha o Cliente por CNPJ normalizado e nega o desconhecido", async () => {
    const { data } = await admin.from("clientes").select("cnpj").eq("id", clienteId).single();
    const cnpj = (data as { cnpj: string }).cnpj;
    expect(await gateway.cnpjCadastrado(cnpj)).toEqual({ ok: true, value: true });
    expect(await gateway.cnpjCadastrado("00000000000191")).toEqual({ ok: true, value: false });
  });

  it("regimeDoCliente devolve o regime do Cliente e null para quem não existe", async () => {
    expect(await gateway.regimeDoCliente(clienteId)).toEqual({
      ok: true,
      value: "simples_nacional",
    });
    expect(await gateway.regimeDoCliente(crypto.randomUUID())).toEqual({ ok: true, value: null });
  });

  it("falha na consulta do regime vira erro, não 'sem Cliente'", async () => {
    const consulta = {
      select: () => consulta,
      eq: () => consulta,
      maybeSingle: async () => ({ data: null, error: { message: "boom" } }),
    };
    const fake = { from: () => consulta } as unknown as SupabaseClient;

    const resultado = await new SupabaseIdentificacaoContatoGateway(fake).regimeDoCliente(
      clienteId,
    );

    expect(resultado.ok).toBe(false);
  });

  it("regime fora da lista vira erro, não string solta", async () => {
    const consulta = {
      select: () => consulta,
      eq: () => consulta,
      maybeSingle: async () => ({ data: { regime: "inventado" }, error: null }),
    };
    const fake = { from: () => consulta } as unknown as SupabaseClient;

    const resultado = await new SupabaseIdentificacaoContatoGateway(fake).regimeDoCliente(
      clienteId,
    );

    expect(resultado.ok).toBe(false);
  });

  it("falha na consulta do CNPJ vira erro, não 'não cadastrado'", async () => {
    const consulta = {
      select: () => consulta,
      eq: () => consulta,
      maybeSingle: async () => ({ data: null, error: { message: "boom" } }),
    };
    const fake = { from: () => consulta } as unknown as SupabaseClient;
    const resultado = await new SupabaseIdentificacaoContatoGateway(fake).cnpjCadastrado(
      "00000000000191",
    );
    expect(resultado.ok).toBe(false);
  });

  it("usuário comum (anon) não consegue chamar a função", async () => {
    const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
    const { error } = await anon.rpc("identificar_contato_por_telefone", {
      p_telefone: "61991112233",
    });
    expect(error).not.toBeNull();
  });
});
