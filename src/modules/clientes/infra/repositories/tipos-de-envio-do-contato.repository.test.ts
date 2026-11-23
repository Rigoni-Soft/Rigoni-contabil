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
let contatoComOsDoisId: string;

beforeAll(async () => {
  await removerClientesDeTeste([CNPJ]);
  clienteId = crypto.randomUUID();
  contatoId = crypto.randomUUID();
  contatoComOsDoisId = crypto.randomUUID();
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
  const comOsDois = await servico.from("cliente_contatos").insert({
    id: contatoComOsDoisId,
    cliente_id: clienteId,
    nome: "Davi Exemplo",
    telefone: "11966660000",
    email: "davi@exemplo.com",
    dono_setor: "simples_nacional",
  });
  if (comOsDois.error) throw comOsDois.error;
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

const canaisGravados = async (contato: string) => {
  const { data } = await servico
    .from("destinos_de_envio")
    .select("canal")
    .eq("cliente_id", clienteId)
    .eq("contato_id", contato);
  return data?.map((d) => d.canal);
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

  it("contato com os dois canais: sem o canal é recusado com a mensagem certa, sem gravar", async () => {
    const sn = await repositorioDe("funcionario.sn@rigonicontabil.local");

    const r = await sn.definir(clienteId, contatoComOsDoisId, ["das"]);

    expect(!r.ok && r.error.message).toBe("Escolha por onde enviar ao contato.");
    expect(await tiposGravados()).toEqual([]);
  });

  it("contato com os dois canais: grava o canal escolhido e o troca na regravação", async () => {
    const sn = await repositorioDe("funcionario.sn@rigonicontabil.local");

    const primeiro = await sn.definir(clienteId, contatoComOsDoisId, ["das", "todos"], "email");
    expect(primeiro.ok).toBe(true);
    expect(await canaisGravados(contatoComOsDoisId)).toEqual(["email", "email"]);

    const segundo = await sn.definir(clienteId, contatoComOsDoisId, ["das", "todos"], "whatsapp");
    expect(segundo.ok).toBe(true);
    expect(await canaisGravados(contatoComOsDoisId)).toEqual(["whatsapp", "whatsapp"]);
  });

  it("deixar de usar (sem tipos) não pede o canal", async () => {
    const sn = await repositorioDe("funcionario.sn@rigonicontabil.local");
    await sn.definir(clienteId, contatoComOsDoisId, ["das"], "email");

    const r = await sn.definir(clienteId, contatoComOsDoisId, []);

    expect(r.ok).toBe(true);
    expect(await tiposGravados()).toEqual([]);
  });

  it("contato com um canal só ignora o canal informado e usa o dele", async () => {
    const sn = await repositorioDe("funcionario.sn@rigonicontabil.local");

    const r = await sn.definir(clienteId, contatoId, ["das"], "email");

    expect(r.ok).toBe(true);
    expect(await canaisGravados(contatoId)).toEqual(["whatsapp"]);
  });

  it("chamadas simultâneas ao mesmo contato (duplo clique) não violam o índice único: todas dão certo", async () => {
    const chamadas = await Promise.all(
      Array.from({ length: 30 }, async () => {
        const sn = await repositorioDe("funcionario.sn@rigonicontabil.local");
        return sn.definir(clienteId, contatoId, ["das", "avisos", "todos"]);
      }),
    );

    expect(chamadas.every((r) => r.ok)).toBe(true);
    expect(await tiposGravados()).toEqual([null, "avisos", "das"]);
  });

  it("quem não gere o Cliente no Setor é recusado, sem gravar", async () => {
    const rh = await repositorioDe("funcionario.rh@rigonicontabil.local");

    const r = await rh.definir(clienteId, contatoId, ["avisos"]);

    expect(r.ok).toBe(false);
    expect(await tiposGravados()).toEqual([]);
  });

  it("quem não gere o Cliente é recusado também com a lista vazia (não vira sucesso silencioso)", async () => {
    const rh = await repositorioDe("funcionario.rh@rigonicontabil.local");

    const r = await rh.definir(clienteId, contatoId, []);

    expect(!r.ok && r.error.message).toBe("Sem permissão para definir os envios deste Cliente.");
  });

  it("elemento nulo na lista (chamada direta) é ignorado: o que saiu da lista sai mesmo assim", async () => {
    const sn = await repositorioDe("funcionario.sn@rigonicontabil.local");
    await sn.definir(clienteId, contatoId, ["das", "avisos"]);
    const direto = await entrar("funcionario.sn@rigonicontabil.local", "func123");

    const { error } = await direto.rpc("definir_tipos_de_envio_do_contato", {
      p_cliente_id: clienteId,
      p_contato_id: contatoId,
      p_tipos: ["avisos", null],
      p_canal: null,
    });

    expect(error).toBeNull();
    expect(await tiposGravados()).toEqual(["avisos"]);
  });

  it("tipo fora do catálogo do Setor vira erro de validação", async () => {
    const sn = await repositorioDe("funcionario.sn@rigonicontabil.local");

    const r = await sn.definir(clienteId, contatoId, ["inexistente"]);

    expect(r.ok).toBe(false);
    expect(await tiposGravados()).toEqual([]);
  });

  it("chamada direta com mais de 12 tipos é recusada pela função, antes de tocar na tabela", async () => {
    const cliente = await entrar("funcionario.sn@rigonicontabil.local", "func123");
    const tipos = Array.from({ length: 13 }, (_, i) => `tipo-${i}`);

    const { error } = await cliente.rpc("definir_tipos_de_envio_do_contato", {
      p_cliente_id: clienteId,
      p_contato_id: contatoId,
      p_tipos: tipos,
    });

    expect(error?.code).toBe("22023");
    expect(error?.message).toContain("Tipos de envio demais");
    expect(await tiposGravados()).toEqual([]);
  });
});
