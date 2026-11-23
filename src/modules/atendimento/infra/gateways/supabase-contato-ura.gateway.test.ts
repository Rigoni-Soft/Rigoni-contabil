/**
 * Integração infra ↔ Supabase: a Recepção cadastra o número do Atendimento como Contato URA do Cliente
 * confirmado (`cadastrar_contato_ura`). Prova os três desfechos (criado, já no Cliente, em outro Cliente),
 * a permissão mínima e a auditoria. Requer `npx supabase start` com migrations + seed aplicados.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  criarClienteDeTeste,
  removerClientesDeTeste,
} from "../../../../../test-support/clientes-de-teste";
import { SupabaseContatoUraGateway } from "./supabase-contato-ura.gateway";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const CNPJ_A = "29700001000120";
const CNPJ_B = "29700002000175";
const TELEFONES = ["5561955590001", "5561955590002", "5561955590003", "5561955590004"];

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function como(
  email: string,
  senha: string,
): Promise<{ supabase: SupabaseClient; id: string }> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) throw new Error(`Falha ao autenticar ${email}: ${error.message}`);
  return { supabase, id: data.user.id };
}

const comoRecepcao = () => como("funcionario.recepcao@rigonicontabil.local", "func123");
const comoOutraRecepcao = () => como("funcionario2.recepcao@rigonicontabil.local", "func123");
const comoFinanceiro = () => como("funcionario.financeiro@rigonicontabil.local", "func123");

async function atendimentoDe(
  telefone: string,
  setor: "recepcao" | "financeiro",
  funcionarioId: string | null,
): Promise<string> {
  // Só há um Atendimento em andamento por número: o de um teste anterior é encerrado.
  await admin
    .from("atendimentos")
    .update({ status: "encerrado" })
    .eq("telefone", telefone)
    .eq("status", "em_andamento");
  const { data, error } = await admin
    .from("atendimentos")
    .insert({
      telefone,
      chave_telefone: telefone.slice(2),
      setor,
      funcionario_id: funcionarioId,
      assumido_em: funcionarioId ? new Date().toISOString() : null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function contatosDoCliente(clienteId: string) {
  const { data, error } = await admin
    .from("cliente_contatos")
    .select("id, nome, telefone, email, dono_setor")
    .eq("cliente_id", clienteId);
  if (error) throw error;
  return data;
}

let clienteA: string;
let clienteB: string;

beforeAll(async () => {
  await removerClientesDeTeste([CNPJ_A, CNPJ_B]);
  await admin.from("atendimentos").delete().in("telefone", TELEFONES);
  clienteA = await criarClienteDeTeste(CNPJ_A, "simples_nacional");
  clienteB = await criarClienteDeTeste(CNPJ_B, "simples_nacional");
});

afterAll(async () => {
  await admin.from("atendimentos").delete().in("telefone", TELEFONES);
  await removerClientesDeTeste([CNPJ_A, CNPJ_B]);
});

describe("SupabaseContatoUraGateway", () => {
  it("lê o Cliente pelo CNPJ para a Recepção confirmar, e devolve null se não existe", async () => {
    const { supabase } = await comoRecepcao();
    const gateway = new SupabaseContatoUraGateway(supabase, admin);
    const achado = await gateway.clientePorCnpj(CNPJ_A);
    expect(achado).toEqual({
      ok: true,
      value: { id: clienteA, empresa: "Cliente de Teste Ltda", cnpj: CNPJ_A },
    });
    const ausente = await gateway.clientePorCnpj("29700009000100");
    expect(ausente).toEqual({ ok: true, value: null });
  });

  it("cadastra o número do Atendimento com setor URA e a Recepção como dona, e audita uma vez", async () => {
    const { supabase, id } = await comoRecepcao();
    const atendimentoId = await atendimentoDe(TELEFONES[0], "recepcao", id);
    const gateway = new SupabaseContatoUraGateway(supabase, admin);

    const r = await gateway.cadastrar({
      atendimentoId,
      clienteId: clienteA,
      nome: "Maria da Padaria",
      email: "maria@padaria.teste",
    });
    expect(r.ok && r.value.status).toBe("criado");

    const contatos = await contatosDoCliente(clienteA);
    expect(contatos).toEqual([
      expect.objectContaining({
        nome: "Maria da Padaria",
        telefone: "61955590001",
        email: "maria@padaria.teste",
        dono_setor: "recepcao",
      }),
    ]);
    const setores = await admin
      .from("cliente_contato_setores")
      .select("setor")
      .eq("contato_id", contatos[0].id);
    expect((setores.data ?? []).map((s) => s.setor).sort()).toEqual(["recepcao", "ura"]);

    const auditoria = await admin
      .from("registros_auditoria")
      .select("acao, ator, setor")
      .eq("alvo", CNPJ_A)
      .in("acao", ["contato.cadastrar-ura", "cliente.editar-operacional"]);
    expect(auditoria.data).toEqual([
      { acao: "contato.cadastrar-ura", ator: id, setor: "recepcao" },
    ]);
  });

  it("número que já é Contato do mesmo Cliente: mostra o existente e não duplica", async () => {
    const { supabase, id } = await comoRecepcao();
    const atendimentoId = await atendimentoDe(TELEFONES[0], "recepcao", id);
    const gateway = new SupabaseContatoUraGateway(supabase, admin);

    const r = await gateway.cadastrar({
      atendimentoId,
      clienteId: clienteA,
      nome: "Outro Nome",
      email: null,
    });
    expect(r.ok && r.value).toEqual({
      status: "existente",
      contatoId: expect.any(String),
      nome: "Maria da Padaria",
    });
    expect(await contatosDoCliente(clienteA)).toHaveLength(1);
  });

  it("número que é Contato de outro Cliente: recusa e não cria", async () => {
    const { supabase, id } = await comoRecepcao();
    const atendimentoId = await atendimentoDe(TELEFONES[0], "recepcao", id);
    const gateway = new SupabaseContatoUraGateway(supabase, admin);

    const r = await gateway.cadastrar({
      atendimentoId,
      clienteId: clienteB,
      nome: "Maria Outra Empresa",
      email: null,
    });
    expect(r).toEqual({ ok: true, value: { status: "em_outro_cliente" } });
    expect(await contatosDoCliente(clienteB)).toEqual([]);
  });

  it("e-mail que já é de outro Contato do Cliente: avisa sem criar", async () => {
    const { supabase, id } = await comoRecepcao();
    const atendimentoId = await atendimentoDe(TELEFONES[1], "recepcao", id);
    const gateway = new SupabaseContatoUraGateway(supabase, admin);

    const r = await gateway.cadastrar({
      atendimentoId,
      clienteId: clienteA,
      nome: "Pedro",
      email: "maria@padaria.teste",
    });
    expect(r.ok && r.value.status).toBe("email_em_uso");
    expect(await contatosDoCliente(clienteA)).toHaveLength(1);
  });

  it("só o dono do Atendimento da Recepção cadastra: outro da Recepção, outro Setor e Atendimento de outro Setor são recusados", async () => {
    const dono = await comoRecepcao();
    const outro = await comoOutraRecepcao();
    const financeiro = await comoFinanceiro();
    const doDono = await atendimentoDe(TELEFONES[2], "recepcao", dono.id);
    const deOutroSetor = await atendimentoDe(TELEFONES[3], "financeiro", financeiro.id);
    const entrada = { clienteId: clienteA, nome: "Intruso", email: null };

    const naoDono = await new SupabaseContatoUraGateway(outro.supabase, admin).cadastrar({
      ...entrada,
      atendimentoId: doDono,
    });
    expect(!naoDono.ok && naoDono.error.code).toBe("FORBIDDEN");

    const setorErrado = await new SupabaseContatoUraGateway(financeiro.supabase, admin).cadastrar({
      ...entrada,
      atendimentoId: deOutroSetor,
    });
    expect(!setorErrado.ok && setorErrado.error.code).toBe("FORBIDDEN");

    const donoEmOutroSetor = await new SupabaseContatoUraGateway(dono.supabase, admin).cadastrar({
      ...entrada,
      atendimentoId: deOutroSetor,
    });
    expect(!donoEmOutroSetor.ok && donoEmOutroSetor.error.code).toBe("FORBIDDEN");

    expect(await contatosDoCliente(clienteA)).toHaveLength(1);
  });

  it("a permissão se limita a criar: a Recepção não altera o contato nem os destinos de envio", async () => {
    const { supabase } = await comoRecepcao();
    const [contato] = await contatosDoCliente(clienteA);

    const edicao = await supabase
      .from("cliente_contatos")
      .update({ nome: "Alterado pela Recepção" })
      .eq("id", contato.id)
      .select("id");
    expect(edicao.data ?? []).toEqual([]);

    const destino = await supabase
      .from("destinos_de_envio")
      .insert({
        cliente_id: clienteA,
        setor: "recepcao",
        contato_id: contato.id,
        tipo: null,
        canal: "whatsapp",
      })
      .select("id");
    expect(destino.error ?? destino.data?.length === 0).toBeTruthy();

    expect((await contatosDoCliente(clienteA))[0].nome).toBe("Maria da Padaria");
  });
});
