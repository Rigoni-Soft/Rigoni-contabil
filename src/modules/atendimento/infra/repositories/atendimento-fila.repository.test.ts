/**
 * Integração infra ↔ Supabase (testes.md, seção 3) da espera do Setor: ninguém é atribuído
 * automaticamente ao abrir, transferir ou encerrar.
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

// Setor só desta suíte: a espera é do Setor inteiro, então nenhuma outra suíte pode usá-lo.
const SETOR = "societario" as const;
const ATOR = (id: string) => ({ id, setor: SETOR });
const TELEFONES = [
  "61955570001",
  "61955570002",
  "61955570003",
  "61955570004",
  "61955570005",
  "61955570006",
  "61955570007",
  "61955570008",
  "61955570009",
];
const clienteId = crypto.randomUUID();
const CNPJ = `7${Date.now()}`.slice(0, 14);
const usuarios: string[] = [];

async function criarFuncionario(nome: string, setor: string = SETOR): Promise<string> {
  const { data } = await admin.auth.admin.createUser({
    email: `fila-47-${nome.replace(/\W/g, "")}-${Date.now()}@teste.local`,
    password: "senha-de-teste-123",
    email_confirm: true,
  });
  const id = data.user!.id;
  usuarios.push(id);
  await admin
    .from("perfis")
    .insert({ id, nome, email: data.user!.email, papel: "funcionario", setor });
  return id;
}

async function abrir(telefone: string, cliente: string | null = null) {
  const r = await repositorio.abrir({
    telefone,
    chave: telefone,
    clienteId: cliente,
    setor: SETOR,
    mensagens: [{ autor: "contato", texto: "oi" }],
  });
  if (!r.ok) throw new Error("abertura falhou");
  return r.value.id;
}

function abrirComDonoNoSetor(telefone: string, funcionarioId: string) {
  return abrirComDono(
    admin,
    repositorio,
    {
      telefone,
      chave: telefone,
      clienteId: null,
      setor: SETOR,
      mensagens: [{ autor: "contato", texto: "oi" }],
    },
    funcionarioId,
  );
}

async function pausa() {
  // `fila_desde` usa o relógio da transação: a ordem só é distinguível entre transações separadas.
  await new Promise((resolve) => setTimeout(resolve, 15));
}

async function linha(id: string) {
  const { data } = await admin
    .from("atendimentos")
    .select("funcionario_id, fila_funcionario_id, setor, status")
    .eq("id", id)
    .single();
  return data;
}

beforeAll(async () => {
  const cliente = await admin
    .from("clientes")
    .insert({ id: clienteId, empresa: "Fila Ltda", cnpj: CNPJ, regime: "lucro_presumido" });
  if (cliente.error) throw cliente.error;
  const contato = await admin.from("cliente_contatos").insert({
    id: crypto.randomUUID(),
    cliente_id: clienteId,
    nome: "Seu Fila",
    telefone: "(61) 95557-0001",
    padrao: true,
  });
  if (contato.error) throw contato.error;
});

afterAll(async () => {
  await admin.from("atendimentos").delete().in("telefone", TELEFONES);
  await admin.from("clientes").delete().eq("id", clienteId);
  for (const id of usuarios) await admin.auth.admin.deleteUser(id);
});

describe("SupabaseAtendimentoRepository — espera do Setor", () => {
  let primeiro: string;
  let segundo: string;
  let terceiro: string;

  it("Atendimento novo espera no Setor mesmo com Funcionário livre, do mais antigo ao mais novo e com o que já se sabe do Contato", async () => {
    await criarFuncionario("Livre Fila 47");
    primeiro = await abrir(TELEFONES[1], clienteId);
    await pausa();
    segundo = await abrir(TELEFONES[2]);
    await pausa();
    terceiro = await abrir(TELEFONES[3]);

    for (const id of [primeiro, segundo, terceiro]) {
      expect(await linha(id)).toMatchObject({ funcionario_id: null, fila_funcionario_id: null });
    }

    const fila = await repositorio.filaDoSetor(SETOR);
    expect(fila.ok && fila.value.map((i) => i.id)).toEqual([primeiro, segundo, terceiro]);
    expect(fila.ok && fila.value[0]).toMatchObject({
      filaFuncionarioId: null,
      telefone: TELEFONES[1],
      contato: { contatoNome: null, empresa: "Fila Ltda", cnpj: CNPJ },
      resumo: null,
    });
    expect(fila.ok && fila.value[0].filaDesde).toBeInstanceOf(Date);
  });

  it("encerrar audita e não atribui o Funcionário liberado ao mais antigo da espera", async () => {
    const dono = await criarFuncionario("Dono Fila 47");
    const emAtendimento = await abrirComDonoNoSetor(TELEFONES[0], dono);

    expect(await repositorio.encerrar(emAtendimento, dono, ATOR(dono))).toEqual({
      ok: true,
      value: { status: "encerrado" },
    });
    const auditoria = await admin
      .from("registros_auditoria")
      .select("acao, resultado, ator")
      .eq("alvo", emAtendimento);
    expect(auditoria.data).toEqual([
      { acao: "atendimento.encerrar", resultado: "sucesso", ator: dono },
    ]);
    // Já encerrado: o dono informado não bate mais com nada em andamento.
    expect(await repositorio.encerrar(emAtendimento, dono, ATOR(dono))).toEqual({
      ok: true,
      value: { status: "inexistente" },
    });

    expect(await linha(primeiro)).toMatchObject({ funcionario_id: null, status: "em_andamento" });
    const assuncoes = await admin
      .from("assuncoes_atendimento")
      .select("atendimento_id")
      .eq("funcionario_id", dono);
    expect(assuncoes.data).toEqual([{ atendimento_id: emAtendimento }]);
  });

  it("transferir manda o Atendimento à espera do Setor de destino, sem escolher Funcionário, e a origem liberada não puxa ninguém", async () => {
    await criarFuncionario("Livre Destino 47", "rh");
    const origem = await criarFuncionario("Origem Transfere 47");
    const atendimentoId = await abrirComDonoNoSetor(TELEFONES[6], origem);

    const r = await repositorio.transferir({
      atendimentoId,
      origemFuncionarioId: origem,
      setorOrigem: SETOR,
      setorDestino: "rh",
      dirigidoA: null,
      resumo: "Folha",
      ator: ATOR(origem),
    });

    expect(r.ok && r.value.status === "transferido" && r.value.destinatarioNome).toBeNull();
    expect(await linha(atendimentoId)).toMatchObject({
      setor: "rh",
      funcionario_id: null,
      fila_funcionario_id: null,
    });
    expect(await linha(segundo)).toMatchObject({ funcionario_id: null });
  });

  it("transferir dirigido espera o destinatário; destinatário de outro Setor é conflito e nada muda", async () => {
    const origem = await criarFuncionario("Origem Dirigida 47");
    const lider = await criarFuncionario("Lider Dirigido 47", "tributario");
    const foraDoSetor = await criarFuncionario("Fora Dirigido 47");
    const atendimentoId = await abrirComDonoNoSetor(TELEFONES[7], origem);
    const base = {
      atendimentoId,
      origemFuncionarioId: origem,
      setorOrigem: SETOR,
      setorDestino: "tributario" as const,
      resumo: "IRPJ",
      ator: ATOR(origem),
    };

    expect(await repositorio.transferir({ ...base, dirigidoA: foraDoSetor })).toEqual({
      ok: true,
      value: { status: "conflito" },
    });
    expect(await linha(atendimentoId)).toMatchObject({ setor: SETOR, funcionario_id: origem });

    const r = await repositorio.transferir({ ...base, dirigidoA: lider });
    expect(r.ok && r.value.status === "transferido" && r.value.destinatarioNome).toBe(
      "Lider Dirigido 47",
    );
    expect(await linha(atendimentoId)).toMatchObject({
      setor: "tributario",
      funcionario_id: null,
      fila_funcionario_id: lider,
    });
  });
});
