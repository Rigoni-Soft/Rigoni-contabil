/**
 * Integração infra ↔ Supabase (testes.md, seção 3) da Transferência de Atendimento (#45).
 * Requer `npx supabase start` local com migrations + seed aplicados.
 */
import { createClient } from "@supabase/supabase-js";

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
const TELEFONE_FILA = "61955550003";
const TELEFONE_RESUMO = "61955550005";
const TELEFONE_SETOR = "61955550006";
const TELEFONE_PROPRIO = "61955550004";
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
  const r = await repositorio.abrir({
    telefone,
    chave: telefone,
    clienteId: cliente,
    setor: "recepcao",
    funcionarioId,
    mensagens: [{ autor: "contato", texto: "oi" }],
  });
  if (!r.ok || r.value.status !== "aberto") throw new Error("abertura falhou");
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
    .in("telefone", [
      TELEFONE,
      TELEFONE_SEM_CLIENTE,
      TELEFONE_FILA,
      TELEFONE_PROPRIO,
      TELEFONE_RESUMO,
      TELEFONE_SETOR,
    ]);
  await admin.from("clientes").delete().eq("id", clienteId);
  for (const id of usuarios) await admin.auth.admin.deleteUser(id);
});

describe("SupabaseAtendimentoRepository — Transferência", () => {
  it("Líder e Admin do Setor também entram no balanceamento, como qualquer Funcionário", async () => {
    const lider = await criarFuncionario("Lider 45", "condominios", "lider_setor");
    liderCondominios = lider;
    const admin = await criarFuncionario("Admin 45", "condominios", "admin");
    const r = await repositorio.funcionariosDoSetor("condominios");
    const ids = r.ok ? r.value.map((f) => f.id) : [];
    expect(ids).toEqual(expect.arrayContaining([lider, admin]));
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
      funcionarioDestinoId: destinoId,
      enfileirarSeOcupado: false,
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

  it("transfere: muda Setor/Funcionário, grava origem e resumo, audita e devolve o contexto", async () => {
    const r = await repositorio.transferir({
      atendimentoId,
      origemFuncionarioId: origemId,
      setorOrigem: "recepcao",
      setorDestino: "simples_nacional",
      funcionarioDestinoId: destinoId,
      enfileirarSeOcupado: false,
      resumo: "  DAS em atraso  ",
      ator: { id: origemId, setor: "recepcao" },
    });
    expect(r).toEqual({
      ok: true,
      value: {
        status: "transferido",
        naFila: false,
        destinatarioNome: "Destino 45",
        origemNome: "Origem 45",
        contato: { contatoNome: "Dona Lia", empresa: "Transfere Ltda", cnpj: CNPJ },
      },
    });

    const { data: atendimento } = await admin
      .from("atendimentos")
      .select("setor, funcionario_id, status")
      .eq("id", atendimentoId)
      .single();
    expect(atendimento).toEqual({
      setor: "simples_nacional",
      funcionario_id: destinoId,
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

  it("recusa (conflito) transferir a Funcionário já ocupado, sem gravar nada", async () => {
    const outro = await abrir(TELEFONE_SEM_CLIENTE, null, null);
    const r = await repositorio.transferir({
      atendimentoId: outro,
      origemFuncionarioId: null,
      setorOrigem: "recepcao",
      setorDestino: "simples_nacional",
      funcionarioDestinoId: destinoId,
      enfileirarSeOcupado: false,
      resumo: "x",
      ator: { id: origemId, setor: "recepcao" },
    });
    expect(r).toEqual({ ok: true, value: { status: "conflito" } });
    const { data } = await admin.from("atendimentos").select("setor").eq("id", outro).single();
    expect(data).toEqual({ setor: "recepcao" });
  });

  it("transfere sem Funcionário (Fila) e sem Contato identificado", async () => {
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
      funcionarioDestinoId: null,
      enfileirarSeOcupado: false,
      resumo: "dúvida",
      ator: { id: origemId, setor: "recepcao" },
    });
    expect(r).toEqual({
      ok: true,
      value: {
        status: "transferido",
        naFila: false,
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

  it("destino fixo ocupado: o Atendimento entra na fila dele, sem dono", async () => {
    // `destinoId` já está com o Atendimento transferido nos testes acima.
    const novo = await abrir(TELEFONE_FILA, null, null);
    const r = await repositorio.transferir({
      atendimentoId: novo,
      origemFuncionarioId: null,
      setorOrigem: "recepcao",
      setorDestino: "contabil",
      funcionarioDestinoId: destinoId,
      enfileirarSeOcupado: true,
      resumo: "fila",
      ator: { id: origemId, setor: "recepcao" },
    });
    expect(r.ok && r.value.status === "transferido" && r.value.naFila).toBe(true);
    expect(r.ok && r.value.status === "transferido" && r.value.destinatarioNome).toBe("Destino 45");
    const { data } = await admin
      .from("atendimentos")
      .select("setor, funcionario_id, fila_funcionario_id, assumido_em")
      .eq("id", novo)
      .single();
    expect(data).toEqual({
      setor: "contabil",
      funcionario_id: null,
      fila_funcionario_id: destinoId,
      assumido_em: null,
    });
  });

  it("destino fixo que já é o dono do próprio Atendimento: não conta como ocupado, fica com ele", async () => {
    const dono = await criarFuncionario("Dono 45", "recepcao", "admin");
    const meu = await abrir(TELEFONE_PROPRIO, null, dono);
    const r = await repositorio.transferir({
      atendimentoId: meu,
      origemFuncionarioId: dono,
      setorOrigem: "recepcao",
      setorDestino: "contabil",
      funcionarioDestinoId: dono,
      enfileirarSeOcupado: true,
      resumo: "eu mesmo",
      ator: { id: dono, setor: "recepcao" },
    });
    expect(r.ok && r.value.status === "transferido" && r.value.naFila).toBe(false);
    const { data } = await admin
      .from("atendimentos")
      .select("funcionario_id, fila_funcionario_id")
      .eq("id", meu)
      .single();
    expect(data).toEqual({ funcionario_id: dono, fila_funcionario_id: null });
  });

  it("resumo vazio ou acima de 1000 caracteres é recusado pelo banco", async () => {
    const id = await abrir(TELEFONE_RESUMO, null, null);
    for (const resumo of ["   ", "a".repeat(1001)]) {
      const r = await repositorio.transferir({
        atendimentoId: id,
        origemFuncionarioId: null,
        setorOrigem: "recepcao",
        setorDestino: "contabil",
        funcionarioDestinoId: null,
        enfileirarSeOcupado: false,
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
      funcionarioDestinoId: null,
      enfileirarSeOcupado: false,
      resumo: "x",
      ator: { id: origemId, setor: "recepcao" },
    });
    expect(r).toEqual({ ok: true, value: { status: "inexistente" } });
    const { data } = await admin.from("atendimentos").select("setor").eq("id", id).single();
    expect(data).toEqual({ setor: "recepcao" });
  });
});
