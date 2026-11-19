/**
 * Integração Supabase: Destinos de envio por Setor, catálogo de tipos e a resolução "quem recebe este
 * envio" no banco (`destinos_de_envio_resolvidos`). Requer `npx supabase start` com migrations + seed
 * aplicados. Dados fictícios (LGPD).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { removerClientesDeTeste } from "../../../../../test-support/clientes-de-teste";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const CNPJ = "11444777009861";
const CNPJ_CASCATA = "11444777009862";
const FUNCIONARIO_RH_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const FUNCIONARIO_SN_ID = "22222222-2222-2222-2222-222222222222";

async function entrar(email: string, senha: string): Promise<SupabaseClient> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) throw new Error(`Falha ao autenticar ${email}: ${error.message}`);
  return supabase;
}

const servico = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const comoFuncionarioRH = () => entrar("funcionario.rh@rigonicontabil.local", "func123");
const comoFuncionarioSN = () => entrar("funcionario.sn@rigonicontabil.local", "func123");

let clienteId: string;

const salvarContatos = (supabase: SupabaseClient, contatos: unknown[]) =>
  supabase.rpc("salvar_contatos_do_cliente", { p_cliente_id: clienteId, p_contatos: contatos });

const contatoPorNome = async (nome: string) => {
  const { data } = await servico
    .from("cliente_contatos")
    .select("id, telefone, email")
    .eq("cliente_id", clienteId)
    .eq("nome", nome)
    .single();
  return data as { id: string; telefone: string | null; email: string | null };
};

const resolver = async (setor: string, tipo: string, canal?: string) => {
  const { data, error } = await servico.rpc("destinos_de_envio_resolvidos", {
    p_cliente_id: clienteId,
    p_setor: setor,
    p_tipo: tipo,
    p_canal: canal ?? null,
  });
  if (error) throw error;
  return (data ?? []) as {
    contato_nome: string;
    canal: string;
    telefone_envio: string | null;
    email: string | null;
    valido: boolean;
    motivo: string | null;
  }[];
};

const destino = (
  setor: string,
  tipo: string | null,
  contatoId: string,
  canal: "whatsapp" | "email" | "whatsapp_e_email",
) => ({ cliente_id: clienteId, setor, tipo, contato_id: contatoId, canal });

const limpar = async () => {
  await servico.from("destinos_de_envio").delete().eq("cliente_id", clienteId);
  await servico.from("cliente_contatos").delete().eq("cliente_id", clienteId);
};

beforeAll(async () => {
  await removerClientesDeTeste([CNPJ, CNPJ_CASCATA]);
  clienteId = crypto.randomUUID();
  const cliente = await servico
    .from("clientes")
    .insert({ id: clienteId, empresa: "Destinos Ltda", cnpj: CNPJ, regime: "simples_nacional" });
  if (cliente.error) throw cliente.error;
  const responsaveis = await servico.from("cliente_responsaveis").insert([
    { cliente_id: clienteId, setor: "rh", responsavel_id: FUNCIONARIO_RH_ID },
    { cliente_id: clienteId, setor: "simples_nacional", responsavel_id: FUNCIONARIO_SN_ID },
  ]);
  if (responsaveis.error) throw responsaveis.error;
});

beforeEach(async () => {
  await limpar();
  const rh = await comoFuncionarioRH();
  const salvo = await salvarContatos(rh, [
    { nome: "Ana Exemplo", telefone: "11999990000", email: "ana@exemplo.com" },
    { nome: "Bia Exemplo", telefone: "11988880000" },
    { nome: "Caio Exemplo", email: "caio@exemplo.com" },
  ]);
  if (salvo.error) throw salvo.error;
});

afterAll(async () => {
  await removerClientesDeTeste([CNPJ, CNPJ_CASCATA]);
});

describe("Destinos de envio (integração)", () => {
  it("o catálogo traz os tipos de hoje e a migration não cria Destinos", async () => {
    const tipos = await servico
      .from("tipos_de_envio_do_setor")
      .select("setor, tipo")
      .order("setor");
    const antes = await servico.from("destinos_de_envio").select("id").eq("cliente_id", clienteId);

    expect(tipos.data).toEqual(
      expect.arrayContaining([
        { setor: "simples_nacional", tipo: "lembrete_documento" },
        { setor: "simples_nacional", tipo: "das" },
        { setor: "simples_nacional", tipo: "guia_parcelamento" },
        { setor: "rh", tipo: "guia_parcelamento" },
        { setor: "simples_nacional", tipo: "avisos" },
        { setor: "rh", tipo: "avisos" },
      ]),
    );
    expect(tipos.data).toHaveLength(6);
    expect(antes.data).toEqual([]);
  });

  it("sem Destino a resolução devolve vazio", async () => {
    expect(await resolver("simples_nacional", "das")).toEqual([]);
  });

  it("tipo específico vale para o tipo; sem ele valem os 'todos'", async () => {
    const ana = await contatoPorNome("Ana Exemplo");
    const bia = await contatoPorNome("Bia Exemplo");
    await servico
      .from("destinos_de_envio")
      .insert([
        destino("simples_nacional", null, ana.id, "whatsapp"),
        destino("simples_nacional", "das", bia.id, "whatsapp"),
      ]);

    const das = await resolver("simples_nacional", "das");
    const lembrete = await resolver("simples_nacional", "lembrete_documento");

    expect(das.map((d) => d.contato_nome)).toEqual(["Bia Exemplo"]);
    expect(lembrete.map((d) => d.contato_nome)).toEqual(["Ana Exemplo"]);
    expect(das[0].telefone_envio).toBe("5511988880000");
  });

  it("um tipo pode ter vários Contatos", async () => {
    const ana = await contatoPorNome("Ana Exemplo");
    const bia = await contatoPorNome("Bia Exemplo");
    await servico
      .from("destinos_de_envio")
      .insert([
        destino("simples_nacional", "das", ana.id, "whatsapp"),
        destino("simples_nacional", "das", bia.id, "whatsapp"),
      ]);

    const das = await resolver("simples_nacional", "das");

    expect(das.map((d) => d.contato_nome).sort()).toEqual(["Ana Exemplo", "Bia Exemplo"]);
  });

  it("o mesmo Contato recebe por WhatsApp num Setor e por e-mail em outro; a resolução é por Setor e canal", async () => {
    const ana = await contatoPorNome("Ana Exemplo");
    await servico
      .from("destinos_de_envio")
      .insert([
        destino("simples_nacional", null, ana.id, "whatsapp"),
        destino("rh", null, ana.id, "email"),
        destino("rh", "guia_parcelamento", ana.id, "whatsapp_e_email"),
      ]);

    const sn = await resolver("simples_nacional", "das");
    const rhAvisos = await resolver("rh", "avisos");
    const rhGuia = await resolver("rh", "guia_parcelamento");
    const rhGuiaSoEmail = await resolver("rh", "guia_parcelamento", "email");
    const rhAvisosSoWhatsapp = await resolver("rh", "avisos", "whatsapp");

    expect(sn).toMatchObject([{ canal: "whatsapp", email: "ana@exemplo.com" }]);
    expect(rhAvisos).toMatchObject([{ canal: "email" }]);
    expect(rhGuia).toMatchObject([{ canal: "whatsapp_e_email", valido: true }]);
    expect(rhGuiaSoEmail).toHaveLength(1);
    expect(rhAvisosSoWhatsapp).toEqual([]);
  });

  it("tipo específico só por e-mail e consulta por WhatsApp devolve vazio, sem cair nos 'todos'", async () => {
    const ana = await contatoPorNome("Ana Exemplo");
    const bia = await contatoPorNome("Bia Exemplo");
    await servico
      .from("destinos_de_envio")
      .insert([
        destino("simples_nacional", null, bia.id, "whatsapp"),
        destino("simples_nacional", "das", ana.id, "email"),
      ]);

    const dasWhatsapp = await resolver("simples_nacional", "das", "whatsapp");
    const dasEmail = await resolver("simples_nacional", "das", "email");
    const lembreteWhatsapp = await resolver("simples_nacional", "lembrete_documento", "whatsapp");

    expect(dasWhatsapp).toEqual([]);
    expect(dasEmail.map((d) => d.contato_nome)).toEqual(["Ana Exemplo"]);
    expect(lembreteWhatsapp.map((d) => d.contato_nome)).toEqual(["Bia Exemplo"]);
  });

  it("o Contato de um Destino não pode ser trocado por UPDATE", async () => {
    const ana = await contatoPorNome("Ana Exemplo");
    const bia = await contatoPorNome("Bia Exemplo");
    const inserido = await servico
      .from("destinos_de_envio")
      .insert(destino("simples_nacional", "das", ana.id, "whatsapp"))
      .select("id")
      .single();

    const troca = await servico
      .from("destinos_de_envio")
      .update({ contato_id: bia.id })
      .eq("id", inserido.data?.id);

    expect(troca.error?.code).toBe("23514");
  });

  it("WhatsApp sem DDD é recusado ao salvar o Contato", async () => {
    const rh = await comoFuncionarioRH();

    const semDdd = await salvarContatos(rh, [{ nome: "Dani Exemplo", telefone: "999990000" }]);
    const comDdd = await salvarContatos(rh, [{ nome: "Dani Exemplo", telefone: "(11) 99999-0001" }]);

    expect(semDdd.error?.code).toBe("22023");
    expect(comDdd.error).toBeNull();
  });

  it("o canal precisa existir no Contato ao gravar", async () => {
    const bia = await contatoPorNome("Bia Exemplo");
    const caio = await contatoPorNome("Caio Exemplo");

    const semEmail = await servico
      .from("destinos_de_envio")
      .insert(destino("simples_nacional", null, bia.id, "email"));
    const semWhatsapp = await servico
      .from("destinos_de_envio")
      .insert(destino("simples_nacional", null, caio.id, "whatsapp"));

    expect(semEmail.error?.code).toBe("23514");
    expect(semWhatsapp.error?.code).toBe("23514");
  });

  it("Contato que ganha um segundo canal não altera o Destino; canal em uso removido o torna inválido e reportado", async () => {
    const rh = await comoFuncionarioRH();
    const bia = await contatoPorNome("Bia Exemplo");
    await servico.from("destinos_de_envio").insert(destino("rh", null, bia.id, "whatsapp"));

    await salvarContatos(rh, [
      { id: bia.id, nome: "Bia Exemplo", telefone: "11988880000", email: "bia@exemplo.com" },
      { nome: "Ana Exemplo", telefone: "11999990000", email: "ana@exemplo.com" },
      { nome: "Caio Exemplo", email: "caio@exemplo.com" },
    ]);
    const depoisDoEmail = await resolver("rh", "avisos");
    await salvarContatos(rh, [
      { id: bia.id, nome: "Bia Exemplo", email: "bia@exemplo.com" },
      { nome: "Ana Exemplo", telefone: "11999990000", email: "ana@exemplo.com" },
      { nome: "Caio Exemplo", email: "caio@exemplo.com" },
    ]);
    const semWhatsapp = await resolver("rh", "avisos");

    expect(depoisDoEmail).toMatchObject([{ canal: "whatsapp", valido: true, motivo: null }]);
    expect(semWhatsapp).toMatchObject([
      { canal: "whatsapp", valido: false, motivo: "sem_whatsapp", telefone_envio: null },
    ]);
  });

  it("cada Setor lê e grava só os seus Destinos (RLS)", async () => {
    const rh = await comoFuncionarioRH();
    const sn = await comoFuncionarioSN();
    const ana = await contatoPorNome("Ana Exemplo");

    const doSn = await sn
      .from("destinos_de_envio")
      .insert(destino("simples_nacional", "das", ana.id, "whatsapp"))
      .select();
    const rhNoSn = await rh
      .from("destinos_de_envio")
      .insert(destino("simples_nacional", null, ana.id, "email"));
    const rhNoRh = await rh.from("destinos_de_envio").insert(destino("rh", null, ana.id, "email"));
    const rhLe = await rh.from("destinos_de_envio").select("setor");
    const snLe = await sn.from("destinos_de_envio").select("setor");

    expect(doSn.error).toBeNull();
    expect(rhNoSn.error).not.toBeNull();
    expect(rhNoRh.error).toBeNull();
    expect(rhLe.data).toEqual([{ setor: "rh" }]);
    expect(snLe.data).toEqual([{ setor: "simples_nacional" }]);
  });

  it("anon não lê Destinos nem o catálogo", async () => {
    const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    expect((await anon.from("destinos_de_envio").select("id")).error).not.toBeNull();
    expect((await anon.from("tipos_de_envio").select("slug")).error).not.toBeNull();
  });

  it("excluir o Contato é recusado, com a lista de Setores, enquanto outro Setor o usa", async () => {
    const rh = await comoFuncionarioRH();
    const sn = await comoFuncionarioSN();
    const ana = await contatoPorNome("Ana Exemplo");
    await sn
      .from("destinos_de_envio")
      .insert(destino("simples_nacional", null, ana.id, "whatsapp"));
    await rh.from("destinos_de_envio").insert(destino("rh", null, ana.id, "whatsapp"));

    const recusado = await salvarContatos(rh, [
      { nome: "Bia Exemplo", telefone: "11988880000" },
      { nome: "Caio Exemplo", email: "caio@exemplo.com" },
    ]);
    const emUso = await servico.from("cliente_contatos").select("id").eq("id", ana.id);

    expect(recusado.error?.code).toBe("23503");
    expect(recusado.error?.message).toContain("Simples Nacional");
    expect(recusado.error?.message).not.toContain("RH");
    expect(emUso.data).toHaveLength(1);
  });

  it("deixar de usar o Contato no próprio Setor não afeta os outros; sem uso de fora, o dono exclui e os seus Destinos caem", async () => {
    const rh = await comoFuncionarioRH();
    const sn = await comoFuncionarioSN();
    const ana = await contatoPorNome("Ana Exemplo");
    await sn
      .from("destinos_de_envio")
      .insert(destino("simples_nacional", null, ana.id, "whatsapp"));
    await rh.from("destinos_de_envio").insert(destino("rh", null, ana.id, "whatsapp"));
    const vinculos = () =>
      servico
        .from("cliente_contato_setores")
        .select("setor")
        .eq("contato_id", ana.id)
        .then((r) => (r.data ?? []).map((v) => v.setor).sort());

    expect(await vinculos()).toEqual(["rh", "simples_nacional", "ura"]);
    await sn.from("destinos_de_envio").delete().eq("cliente_id", clienteId);
    expect(await vinculos()).toEqual(["rh", "ura"]);
    expect(await resolver("rh", "avisos")).toHaveLength(1);

    const excluido = await salvarContatos(rh, [
      { nome: "Bia Exemplo", telefone: "11988880000" },
      { nome: "Caio Exemplo", email: "caio@exemplo.com" },
    ]);
    const restam = await servico.from("destinos_de_envio").select("id").eq("cliente_id", clienteId);

    expect(excluido.error).toBeNull();
    expect(restam.data).toEqual([]);
  });

  it("apagar o Cliente leva os Contatos e Destinos junto, sem recusa", async () => {
    const outro = crypto.randomUUID();
    const cnpj = CNPJ_CASCATA;
    await removerClientesDeTeste([cnpj]);
    await servico
      .from("clientes")
      .insert({ id: outro, empresa: "Cascata Ltda", cnpj, regime: "simples_nacional" });
    const contato = crypto.randomUUID();
    await servico
      .from("cliente_contatos")
      .insert({ id: contato, cliente_id: outro, nome: "Ana Exemplo", telefone: "11999990000" });
    await servico
      .from("destinos_de_envio")
      .insert({ cliente_id: outro, setor: "rh", contato_id: contato, canal: "whatsapp" });

    await expect(removerClientesDeTeste([cnpj])).resolves.toBeUndefined();
    const sobrou = await servico.from("destinos_de_envio").select("id").eq("cliente_id", outro);
    expect(sobrou.data).toEqual([]);
  });
});
