/**
 * Integração Supabase: o Contato do Cliente com e-mail, Setores, Setor dono e id estável. Um caminho
 * único de salvar (`salvar_contatos_do_cliente`), só o dono e o Admin editam, número e e-mail não
 * repetem no Cliente (mas repetem entre Clientes) e a busca por telefone vive numa função só.
 * Requer `npx supabase start` com migrations + seed aplicados. Dados fictícios (LGPD).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { removerClientesDeTeste } from "../../../../../test-support/clientes-de-teste";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const CNPJ_A = "11444777009851";
const CNPJ_B = "11444777009852";
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
const comoAdmin = () => entrar("admin@rigonicontabil.local", "admin123");

let clienteA: string;
let clienteB: string;

const salvar = (supabase: SupabaseClient, cliente: string, contatos: unknown[]) =>
  supabase.rpc("salvar_contatos_do_cliente", { p_cliente_id: cliente, p_contatos: contatos });

const ler = async (cliente: string) => {
  const { data, error } = await servico
    .from("cliente_contatos")
    .select("id, nome, telefone, email, dono_setor, cliente_contato_setores(setor)")
    .eq("cliente_id", cliente)
    .order("criado_em");
  if (error) throw error;
  return data ?? [];
};

const limpar = () =>
  servico.from("cliente_contatos").delete().in("cliente_id", [clienteA, clienteB]);

beforeAll(async () => {
  await removerClientesDeTeste([CNPJ_A, CNPJ_B]);
  clienteA = crypto.randomUUID();
  clienteB = crypto.randomUUID();
  for (const [id, cnpj, empresa] of [
    [clienteA, CNPJ_A, "Contatos A Ltda"],
    [clienteB, CNPJ_B, "Contatos B Ltda"],
  ]) {
    const criado = await servico
      .from("clientes")
      .insert({ id, empresa, cnpj, regime: "lucro_presumido" });
    if (criado.error) throw criado.error;
  }
  const responsaveis = await servico.from("cliente_responsaveis").insert([
    { cliente_id: clienteA, setor: "rh", responsavel_id: FUNCIONARIO_RH_ID },
    { cliente_id: clienteA, setor: "simples_nacional", responsavel_id: FUNCIONARIO_SN_ID },
  ]);
  if (responsaveis.error) throw responsaveis.error;
});

beforeEach(async () => {
  await limpar();
});

afterAll(async () => {
  await removerClientesDeTeste([CNPJ_A, CNPJ_B]);
});

describe("Contato do Cliente (integração)", () => {
  it("o Setor que cadastra é o dono e o contato nasce com a URA e o Setor", async () => {
    const rh = await comoFuncionarioRH();

    const { error } = await salvar(rh, clienteA, [
      { nome: "Maria Exemplo", telefone: "11999990000", email: "Maria@Exemplo.com" },
    ]);
    const [contato] = await ler(clienteA);

    expect(error).toBeNull();
    expect(contato).toMatchObject({
      nome: "Maria Exemplo",
      email: "maria@exemplo.com",
      dono_setor: "rh",
    });
    expect(contato.cliente_contato_setores.map((s) => s.setor).sort()).toEqual(["rh", "ura"]);
  });

  it("o id se mantém entre salvamentos, e quem sai da lista é removido", async () => {
    const rh = await comoFuncionarioRH();
    await salvar(rh, clienteA, [
      { nome: "Maria Exemplo", telefone: "11999990000" },
      { nome: "João Exemplo", email: "joao@exemplo.com" },
    ]);
    const [maria, joao] = await ler(clienteA);

    await salvar(rh, clienteA, [
      { id: maria.id, nome: "Maria Silva Exemplo", telefone: "11999990000" },
    ]);
    const depois = await ler(clienteA);

    expect(depois).toHaveLength(1);
    expect(depois[0]).toMatchObject({ id: maria.id, nome: "Maria Silva Exemplo" });
    expect(depois.map((c) => c.id)).not.toContain(joao.id);
  });

  it("exige nome e ao menos um canal (WhatsApp ou e-mail)", async () => {
    const rh = await comoFuncionarioRH();

    const semCanal = await salvar(rh, clienteA, [{ nome: "Sem Canal" }]);
    const semNome = await salvar(rh, clienteA, [{ nome: " ", telefone: "11999990000" }]);
    const soEmail = await salvar(rh, clienteA, [{ nome: "Só E-mail", email: "so@exemplo.com" }]);

    expect(semCanal.error).not.toBeNull();
    expect(semNome.error).not.toBeNull();
    expect(soEmail.error).toBeNull();
  });

  it("o mesmo WhatsApp (normalizado) ou e-mail não vira dois contatos no Cliente e aponta o existente", async () => {
    const rh = await comoFuncionarioRH();
    await salvar(rh, clienteA, [
      { nome: "Maria Exemplo", telefone: "(11) 99999-0000", email: "m@exemplo.com" },
    ]);
    const [existente] = await ler(clienteA);

    const mesmoNumero = await salvar(rh, clienteA, [
      { id: existente.id, nome: "Maria Exemplo", telefone: "11999990000" },
      { nome: "Outra Pessoa", telefone: "+55 11 99999-0000" },
    ]);
    const mesmoEmail = await salvar(rh, clienteA, [
      { id: existente.id, nome: "Maria Exemplo", telefone: "11999990000", email: "m@exemplo.com" },
      { nome: "Outra Pessoa", email: "M@Exemplo.com" },
    ]);

    expect(mesmoNumero.error?.code).toBe("23505");
    expect(mesmoNumero.error?.hint).toBe(existente.id);
    expect(mesmoEmail.error?.code).toBe("23505");
    expect(mesmoEmail.error?.hint).toBe(existente.id);
  });

  it("o mesmo número em Clientes diferentes é aceito", async () => {
    const admin = await comoAdmin();

    const a = await salvar(admin, clienteA, [{ nome: "Ana Exemplo", telefone: "11988887777" }]);
    const b = await salvar(admin, clienteB, [{ nome: "Ana Exemplo", telefone: "11988887777" }]);

    expect(a.error).toBeNull();
    expect(b.error).toBeNull();
  });

  it("só o dono e o Admin editam ou removem; outro Setor recebe o contato de volta sem alterar", async () => {
    const rh = await comoFuncionarioRH();
    const sn = await comoFuncionarioSN();
    await salvar(rh, clienteA, [{ nome: "Maria Exemplo", telefone: "11999990000" }]);
    const [maria] = await ler(clienteA);

    const editar = await salvar(sn, clienteA, [
      { id: maria.id, nome: "Trocada", telefone: "11999990000" },
    ]);
    const remover = await salvar(sn, clienteA, []);
    const devolver = await salvar(sn, clienteA, [
      { id: maria.id, nome: "Maria Exemplo", telefone: "11999990000" },
    ]);

    expect(editar.error?.code).toBe("42501");
    expect(remover.error?.code).toBe("42501");
    expect(devolver.error).toBeNull();
    expect((await ler(clienteA))[0].nome).toBe("Maria Exemplo");
  });

  it("a escrita direta na tabela também respeita o dono (RLS)", async () => {
    const rh = await comoFuncionarioRH();
    const sn = await comoFuncionarioSN();
    await salvar(rh, clienteA, [{ nome: "Maria Exemplo", telefone: "11999990000" }]);
    const [maria] = await ler(clienteA);

    const direto = await sn
      .from("cliente_contatos")
      .update({ nome: "Trocada" })
      .eq("id", maria.id)
      .select();
    const apagar = await sn.from("cliente_contatos").delete().eq("id", maria.id).select();

    expect(direto.data).toEqual([]);
    expect(apagar.data).toEqual([]);
    expect((await ler(clienteA))[0].nome).toBe("Maria Exemplo");
  });

  it("o Admin cria com a URA e o Admin como dono, e edita o contato de qualquer Setor", async () => {
    const admin = await comoAdmin();
    const rh = await comoFuncionarioRH();
    await salvar(admin, clienteA, [{ nome: "Contato do Admin", telefone: "11977776666" }]);
    const [doAdmin] = await ler(clienteA);

    const rhEdita = await salvar(rh, clienteA, [
      { id: doAdmin.id, nome: "Trocado", telefone: "11977776666" },
    ]);
    await salvar(rh, clienteA, [
      { id: doAdmin.id, nome: "Contato do Admin", telefone: "11977776666" },
      { nome: "Maria Exemplo", telefone: "11999990000" },
    ]);
    const [, maria] = await ler(clienteA);
    const adminEdita = await salvar(admin, clienteA, [
      { id: doAdmin.id, nome: "Contato do Admin", telefone: "11977776666" },
      { id: maria.id, nome: "Maria Corrigida", telefone: "11999990000" },
    ]);

    expect(doAdmin.dono_setor).toBeNull();
    expect(doAdmin.cliente_contato_setores.map((s) => s.setor)).toEqual(["ura"]);
    expect(rhEdita.error?.code).toBe("42501");
    expect(adminEdita.error).toBeNull();
    expect((await ler(clienteA)).map((c) => c.nome)).toEqual([
      "Contato do Admin",
      "Maria Corrigida",
    ]);
  });

  it("a função de busca acha o contato do Cliente por qualquer formatação do número", async () => {
    await servico.from("cliente_contatos").insert({
      id: crypto.randomUUID(),
      cliente_id: clienteA,
      nome: "Maria Exemplo",
      telefone: "(11) 99999-0000",
    });

    for (const numero of ["11999990000", "5511999990000", "+55 (11) 99999-0000"]) {
      const { data } = await servico.rpc("contato_por_telefone_no_cliente", {
        p_cliente_id: clienteA,
        p_telefone: numero,
      });
      expect(data).toMatchObject([{ nome: "Maria Exemplo" }]);
    }
    const outro = await servico.rpc("contato_por_telefone_no_cliente", {
      p_cliente_id: clienteB,
      p_telefone: "11999990000",
    });
    expect(outro.data).toEqual([]);
  });

  it("a URA acha o Cliente em contato de qualquer Setor dono; número em dois Clientes vem em duas linhas", async () => {
    const rh = await comoFuncionarioRH();
    const admin = await comoAdmin();
    await salvar(rh, clienteA, [{ nome: "Maria Exemplo", telefone: "11955554444" }]);

    const um = await servico.rpc("identificar_contato_por_telefone", { p_telefone: "11955554444" });
    await salvar(admin, clienteB, [{ nome: "Maria Exemplo", telefone: "11955554444" }]);
    const dois = await servico.rpc("identificar_contato_por_telefone", {
      p_telefone: "11955554444",
    });

    expect(um.data).toMatchObject([{ cliente_id: clienteA, empresa: "Contatos A Ltda" }]);
    expect((dois.data as { cliente_id: string }[]).map((l) => l.cliente_id).sort()).toEqual(
      [clienteA, clienteB].sort(),
    );
  });

  it("contato inserido sem Setor ganha a URA, e a lista de Setores tem a URA e os nove Setores", async () => {
    const id = crypto.randomUUID();
    await servico
      .from("cliente_contatos")
      .insert({ id, cliente_id: clienteA, nome: "Maria Exemplo", telefone: "11999990000" });
    const vinculos = await servico
      .from("cliente_contato_setores")
      .select("setor")
      .eq("contato_id", id);
    const setores = await servico.from("setores_de_contato").select("slug");

    expect(vinculos.data).toEqual([{ setor: "ura" }]);
    expect(setores.data?.map((s) => s.slug).sort()).toEqual(
      [
        "administrativo",
        "condominios",
        "contabil",
        "financeiro",
        "recepcao",
        "rh",
        "simples_nacional",
        "societario",
        "tributario",
        "ura",
      ].sort(),
    );
  });

  it("salvar_contato_do_cliente grava só aquele contato: cria, atualiza por id e não remove os outros", async () => {
    const rh = await comoFuncionarioRH();
    await salvar(rh, clienteA, [{ nome: "Maria Exemplo", telefone: "11999990000" }]);

    const criado = await rh.rpc("salvar_contato_do_cliente", {
      p_cliente_id: clienteA,
      p_contato: { nome: "João Exemplo", email: "Joao@Exemplo.com" },
    });
    const id = criado.data as string;
    const atualizado = await rh.rpc("salvar_contato_do_cliente", {
      p_cliente_id: clienteA,
      p_contato: { id, nome: "João Silva Exemplo", email: "joao@exemplo.com" },
    });
    const todos = await ler(clienteA);

    expect(criado.error).toBeNull();
    expect(atualizado.error).toBeNull();
    expect(atualizado.data).toBe(id);
    expect(todos.map((c) => c.nome).sort()).toEqual(["João Silva Exemplo", "Maria Exemplo"]);
    expect(todos.find((c) => c.id === id)).toMatchObject({
      email: "joao@exemplo.com",
      dono_setor: "rh",
    });
  });

  it("salvar_contato_do_cliente recusa repetir o WhatsApp no Cliente e o contato de outro Setor", async () => {
    const rh = await comoFuncionarioRH();
    const sn = await comoFuncionarioSN();
    const { data: idRh } = await rh.rpc("salvar_contato_do_cliente", {
      p_cliente_id: clienteA,
      p_contato: { nome: "Maria Exemplo", telefone: "11999990000" },
    });

    const repetido = await rh.rpc("salvar_contato_do_cliente", {
      p_cliente_id: clienteA,
      p_contato: { nome: "Outra Exemplo", telefone: "(11) 99999-0000" },
    });
    const deOutroSetor = await sn.rpc("salvar_contato_do_cliente", {
      p_cliente_id: clienteA,
      p_contato: { id: idRh, nome: "Invadido", telefone: "11999990000" },
    });

    expect(repetido.error?.code).toBe("23505");
    expect(deOutroSetor.error?.code).toBe("42501");
    expect((await ler(clienteA)).map((c) => c.nome)).toEqual(["Maria Exemplo"]);
  });

  it("anon não lê contatos nem a lista de Setores", async () => {
    const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const contatos = await anon.from("cliente_contatos").select("id");
    const setores = await anon.from("setores_de_contato").select("slug");
    const vinculos = await anon.from("cliente_contato_setores").select("setor");

    expect(contatos.error).not.toBeNull();
    expect(setores.error).not.toBeNull();
    expect(vinculos.error).not.toBeNull();
  });
});
