/**
 * Integração infra ↔ Supabase (testes.md, seção 3) da Transferência de Atendimento.
 * Requer `npx supabase start` local com migrations + seed aplicados.
 */
import { createClient } from "@supabase/supabase-js";

import { abrirComDono } from "../../../../../test-support/atendimento-com-dono";
import { SupabaseAtendimentoRepository } from "./atendimento.repository";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const repositorio = new SupabaseAtendimentoRepository(admin);

// Números e CNPJ desta suíte, longe do seed e das outras.
const TELEFONE = "61955550001";
const TELEFONE_SEM_CLIENTE = "61955550002";
const TELEFONE_RESUMO = "61955550005";
const TELEFONE_SETOR = "61955550006";
const clienteId = crypto.randomUUID();
const CNPJ = `8${Date.now()}`.slice(0, 14);
const usuarios: string[] = [];
let origemId: string;
let destinoId: string;
let atendimentoId: string;
let liderCondominios: string;

async function criarFuncionario(
  nome: string,
  setor: string,
  papel = "funcionario",
): Promise<string> {
  const { data } = await admin.auth.admin.createUser({
    email: `transferencia-45-${nome.replace(/\W/g, "")}-${Date.now()}@teste.local`,
    password: "senha-de-teste-123",
    email_confirm: true,
  });
  const id = data.user!.id;
  usuarios.push(id);
  await admin.from("perfis").insert({ id, nome, email: data.user!.email, papel, setor });
  return id;
}

async function abrir(telefone: string, cliente: string | null, funcionarioId: string | null) {
  const abertura = {
    telefone,
    chave: telefone,
    clienteId: cliente,
    setor: "recepcao" as const,
    mensagens: [{ autor: "contato" as const, texto: "oi" }],
  };
  if (funcionarioId) return abrirComDono(admin, repositorio, abertura, funcionarioId);
  const r = await repositorio.abrir(abertura);
  if (!r.ok) throw new Error("abertura falhou");
  return r.value.id;
}

beforeAll(async () => {
  origemId = await criarFuncionario("Origem 45", "recepcao");
  destinoId = await criarFuncionario("Destino 45", "simples_nacional");
  const cliente = await admin
    .from("clientes")
    .insert({ id: clienteId, empresa: "Transfere Ltda", cnpj: CNPJ, regime: "simples_nacional" });
  if (cliente.error) throw cliente.error;
  const contato = await admin.from("cliente_contatos").insert({
    id: crypto.randomUUID(),
    cliente_id: clienteId,
    nome: "Dona Lia",
    telefone: "(61) 95555-0001",
    padrao: true,
  });
  if (contato.error) throw contato.error;
  atendimentoId = await abrir(TELEFONE, clienteId, origemId);
});

afterAll(async () => {
  await admin
    .from("atendimentos")
    .delete()
    .in("telefone", [TELEFONE, TELEFONE_SEM_CLIENTE, TELEFONE_RESUMO, TELEFONE_SETOR]);
  await admin.from("clientes").delete().eq("id", clienteId);
  for (const id of usuarios) await admin.auth.admin.deleteUser(id);
});

describe("SupabaseAtendimentoRepository — Transferência", () => {
  it("prepara o Líder de Condomínios", async () => {
    liderCondominios = await criarFuncionario("Lider 45", "condominios", "lider_setor");
  });

  it("lê o Atendimento em andamento e devolve null para id desconhecido", async () => {
    expect(await repositorio.buscarEmAndamento(atendimentoId)).toEqual({
      ok: true,
      value: {
        id: atendimentoId,
        clienteId,
        setor: "recepcao",
        funcionarioId: origemId,
        telefone: TELEFONE,
        chave: TELEFONE,
        emAvisoDeInatividade: false,
      },
    });
    expect(await repositorio.buscarEmAndamento(crypto.randomUUID())).toEqual({
      ok: true,
      value: null,
    });
  });

  it("recusa (inexistente) quando o dono mudou desde a leitura, sem gravar nada", async () => {
    const r = await repositorio.transferir({
      atendimentoId,
      origemFuncionarioId: destinoId,
      setorOrigem: "recepcao",
      setorDestino: "simples_nacional",
      dirigidoA: destinoId,
      resumo: "x",
      ator: { id: origemId, setor: "recepcao" },
    });
    expect(r).toEqual({ ok: true, value: { status: "inexistente" } });
    const { count } = await admin
      .from("transferencias")
      .select("*", { count: "exact", head: true })
      .eq("atendimento_id", atendimentoId);
    expect(count).toBe(0);
  });

  it("transfere dirigido: muda Setor, espera o destinatário sem dono, grava origem e resumo, audita e devolve o contexto", async () => {
    const r = await repositorio.transferir({
      atendimentoId,
      origemFuncionarioId: origemId,
      setorOrigem: "recepcao",
      setorDestino: "simples_nacional",
      dirigidoA: destinoId,
      resumo: "  DAS em atraso  ",
      ator: { id: origemId, setor: "recepcao" },
    });
    expect(r).toEqual({
      ok: true,
      value: {
        status: "transferido",
        destinatarioNome: "Destino 45",
        origemNome: "Origem 45",
        contato: { contatoNome: "Dona Lia", empresa: "Transfere Ltda", cnpj: CNPJ },
      },
    });

    const { data: atendimento } = await admin
      .from("atendimentos")
      .select("setor, funcionario_id, fila_funcionario_id, assumido_em, status")
      .eq("id", atendimentoId)
      .single();
    expect(atendimento).toEqual({
      setor: "simples_nacional",
      funcionario_id: null,
      fila_funcionario_id: destinoId,
      assumido_em: null,
      status: "em_andamento",
    });
    const { data: transferencia } = await admin
      .from("transferencias")
      .select("setor_origem, funcionario_origem_id, setor_destino, funcionario_destino_id, resumo")
      .eq("atendimento_id", atendimentoId)
      .single();
    expect(transferencia).toEqual({
      setor_origem: "recepcao",
      funcionario_origem_id: origemId,
      setor_destino: "simples_nacional",
      funcionario_destino_id: destinoId,
      resumo: "DAS em atraso",
    });
    const { data: auditoria } = await admin
      .from("registros_auditoria")
      .select("ator, setor, resultado")
      .eq("acao", "atendimento.transferir")
      .eq("alvo", atendimentoId);
    expect(auditoria).toEqual([{ ator: origemId, setor: "recepcao", resultado: "sucesso" }]);
  });

  it("recusa (conflito) dirigir a quem não é do Setor de destino, sem gravar nada", async () => {
    const outro = await abrir(TELEFONE_SEM_CLIENTE, null, null);
    const r = await repositorio.transferir({
      atendimentoId: outro,
      origemFuncionarioId: null,
      setorOrigem: "recepcao",
      setorDestino: "contabil",
      dirigidoA: destinoId,
      resumo: "x",
      ator: { id: origemId, setor: "recepcao" },
    });
    expect(r).toEqual({ ok: true, value: { status: "conflito" } });
    const { data } = await admin.from("atendimentos").select("setor").eq("id", outro).single();
    expect(data).toEqual({ setor: "recepcao" });
  });

  it("transfere para a espera do Setor, sem Contato identificado", async () => {
    const { data } = await admin
      .from("atendimentos")
      .select("id")
      .eq("telefone", TELEFONE_SEM_CLIENTE)
      .single();
    const r = await repositorio.transferir({
      atendimentoId: data!.id,
      origemFuncionarioId: null,
      setorOrigem: "recepcao",
      setorDestino: "contabil",
      dirigidoA: null,
      resumo: "dúvida",
      ator: { id: origemId, setor: "recepcao" },
    });
    expect(r).toEqual({
      ok: true,
      value: {
        status: "transferido",
        destinatarioNome: null,
        origemNome: null,
        contato: { contatoNome: null, empresa: null, cnpj: null },
      },
    });
  });

  it("lê Regime e Responsável do Cliente e o Líder do Setor", async () => {
    expect(await repositorio.roteamentoDoCliente(clienteId)).toEqual({
      ok: true,
      value: { regime: "simples_nacional", responsavelId: null },
    });
    const op = await admin
      .from("cliente_cadastro_operacional_sn")
      .insert({ cliente_id: clienteId, responsavel_id: destinoId });
    if (op.error) throw op.error;
    expect(await repositorio.roteamentoDoCliente(clienteId)).toEqual({
      ok: true,
      value: { regime: "simples_nacional", responsavelId: destinoId },
    });
    expect(await repositorio.roteamentoDoCliente(crypto.randomUUID())).toEqual({
      ok: true,
      value: null,
    });
    const lider = await repositorio.liderDoSetor("condominios");
    expect(lider.ok && lider.value).toBeTruthy();
    const { data } = await admin
      .from("perfis")
      .select("papel, setor")
      .eq("id", lider.ok ? (lider.value ?? "") : "")
      .single();
    expect(data).toEqual({ papel: "lider_setor", setor: "condominios" });
    expect(liderCondominios).toBeTruthy();
  });

  it("resumo vazio ou acima de 1000 caracteres é recusado pelo banco", async () => {
    const id = await abrir(TELEFONE_RESUMO, null, null);
    for (const resumo of ["   ", "a".repeat(1001)]) {
      const r = await repositorio.transferir({
        atendimentoId: id,
        origemFuncionarioId: null,
        setorOrigem: "recepcao",
        setorDestino: "contabil",
        dirigidoA: null,
        resumo,
        ator: { id: origemId, setor: "recepcao" },
      });
      expect(r.ok).toBe(false);
    }
    const { data } = await admin.from("atendimentos").select("setor").eq("id", id).single();
    expect(data).toEqual({ setor: "recepcao" });
  });

  it("recusa (inexistente) quando o Setor mudou desde a leitura, mesmo sem dono, sem gravar nada", async () => {
    const id = await abrir(TELEFONE_SETOR, null, null);
    const r = await repositorio.transferir({
      atendimentoId: id,
      origemFuncionarioId: null,
      setorOrigem: "financeiro",
      setorDestino: "contabil",
      dirigidoA: null,
      resumo: "x",
      ator: { id: origemId, setor: "recepcao" },
    });
    expect(r).toEqual({ ok: true, value: { status: "inexistente" } });
    const { data } = await admin.from("atendimentos").select("setor").eq("id", id).single();
    expect(data).toEqual({ setor: "recepcao" });
  });

  // Cada teste desativa o perfil, confere e reativa — sem depender da ordem da suíte.
  async function comDesativado(id: string, verificar: () => Promise<void>) {
    await admin.from("perfis").update({ desativado_em: new Date().toISOString() }).eq("id", id);
    try {
      await verificar();
    } finally {
      await admin.from("perfis").update({ desativado_em: null }).eq("id", id);
    }
  }

  it("Responsável desativado não é destino: o Cliente fica sem Responsável", async () => {
    const op = await admin
      .from("cliente_cadastro_operacional_sn")
      .upsert({ cliente_id: clienteId, responsavel_id: destinoId });
    if (op.error) throw op.error;
    await comDesativado(destinoId, async () => {
      expect(await repositorio.roteamentoDoCliente(clienteId)).toEqual({
        ok: true,
        value: { regime: "simples_nacional", responsavelId: null },
      });
    });
  });

  it("Líder desativado não é destino: o Setor fica sem Líder", async () => {
    await comDesativado(liderCondominios, async () => {
      expect(await repositorio.liderDoSetor("condominios")).toEqual({ ok: true, value: null });
    });
    expect(await repositorio.liderDoSetor("condominios")).toEqual({
      ok: true,
      value: liderCondominios,
    });
  });
});
