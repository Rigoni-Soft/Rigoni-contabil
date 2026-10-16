/**
 * Integração infra ↔ Supabase (testes.md, seção 3) das garantias de integridade: só atendente
 * ativo e do Setor recebe, a Fila antiga passa na frente e o crédito mensal sobrevive à Transferência. Requer `npx supabase start` local com migrations + seed.
 */
import { createClient } from "@supabase/supabase-js";

import { SupabaseAtendimentoRepository } from "./atendimento.repository";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const repositorio = new SupabaseAtendimentoRepository(admin);

// Setor só desta suíte (nenhuma outra o usa para Atendimento) e números longe das outras.
const SETOR = "administrativo" as const;
const OUTRO_SETOR = "tributario" as const;
const telefone = (n: number) => `619555730${String(n).padStart(2, "0")}`;
const usuarios: string[] = [];
const telefonesUsados: string[] = [];
let proximoNumero = 1;

async function criarPerfil(
  nome: string,
  setor: string = SETOR,
  papel: "funcionario" | "lider_setor" = "funcionario",
): Promise<string> {
  const { data } = await admin.auth.admin.createUser({
    email: `integridade-77-${nome.replace(/\W/g, "")}-${Date.now()}@teste.local`,
    password: "senha-de-teste-123",
    email_confirm: true,
  });
  const id = data.user!.id;
  usuarios.push(id);
  const { error } = await admin
    .from("perfis")
    .insert({ id, nome, email: data.user!.email, papel, setor });
  if (error) throw error;
  return id;
}

const desativar = (id: string) =>
  admin.from("perfis").update({ desativado_em: new Date().toISOString() }).eq("id", id);

function numero(): string {
  const n = telefone(proximoNumero++);
  telefonesUsados.push(n);
  return n;
}

async function abrir(funcionarioId: string | null, setor: string = SETOR) {
  const tel = numero();
  const r = await repositorio.abrir({
    telefone: tel,
    chave: tel,
    clienteId: null,
    setor: setor as typeof SETOR,
    funcionarioId,
    mensagens: [{ autor: "contato", texto: "oi" }],
  });
  if (!r.ok) throw new Error("falha técnica ao abrir");
  return { telefone: tel, resultado: r.value };
}

async function atendimentoDe(tel: string) {
  const { data } = await admin
    .from("atendimentos")
    .select("id, setor, funcionario_id, fila_funcionario_id")
    .eq("chave_telefone", tel);
  return data ?? [];
}

async function pausa() {
  // `fila_desde` ordena a Fila: precisa de instantes distintos entre as operações.
  await new Promise((resolve) => setTimeout(resolve, 15));
}

async function creditoDoMes(setor: typeof SETOR, funcionarioId: string): Promise<number> {
  const r = await repositorio.funcionariosDoSetor(setor);
  if (!r.ok) throw new Error("falha técnica");
  return r.value.find((f) => f.id === funcionarioId)?.atendimentosNoMes ?? -1;
}

// Cada teste começa sem ninguém esperando na Fila do Setor desta suíte: quem sobra de um teste
// passaria na frente do próximo (é justamente a regra).
beforeEach(async () => {
  await admin
    .from("atendimentos")
    .update({ status: "encerrado" })
    .in("chave_telefone", telefonesUsados)
    .is("funcionario_id", null)
    .eq("status", "em_andamento");
});

afterAll(async () => {
  await admin.from("atendimentos").delete().in("chave_telefone", telefonesUsados);
  for (const id of usuarios) await admin.auth.admin.deleteUser(id);
});

describe("B2 — só atendente ativo e do Setor recebe Atendimento", () => {
  it("conta desativada não aparece no Balanceamento", async () => {
    const ativo = await criarPerfil("Ativo B2");
    const inativo = await criarPerfil("Inativo B2");
    await desativar(inativo);

    const r = await repositorio.funcionariosDoSetor(SETOR);

    const ids = r.ok ? r.value.map((f) => f.id) : [];
    expect(ids).toContain(ativo);
    expect(ids).not.toContain(inativo);
  });

  it("abrir com desativado ou com alguém de outro Setor é recusado, sem gravar nada", async () => {
    const inativo = await criarPerfil("Inativo Abre B2");
    await desativar(inativo);
    const deOutroSetor = await criarPerfil("Outro Setor B2", OUTRO_SETOR);

    const a = await abrir(inativo);
    const b = await abrir(deOutroSetor);

    expect(a.resultado.status).toBe("conflito");
    expect(b.resultado.status).toBe("conflito");
    expect(await atendimentoDe(a.telefone)).toEqual([]);
    expect(await atendimentoDe(b.telefone)).toEqual([]);
  });

  it("transferir para desativado ou para alguém de outro Setor é recusado e o Atendimento não muda", async () => {
    const origem = await criarPerfil("Origem B2", OUTRO_SETOR);
    const inativo = await criarPerfil("Destino Inativo B2");
    await desativar(inativo);
    const deOutroSetor = await criarPerfil("Destino Outro Setor B2", "financeiro");
    const { telefone: tel, resultado } = await abrir(origem, OUTRO_SETOR);
    if (resultado.status !== "aberto") throw new Error("setup");

    for (const destino of [inativo, deOutroSetor]) {
      const r = await repositorio.transferir({
        atendimentoId: resultado.id,
        origemFuncionarioId: origem,
        setorOrigem: OUTRO_SETOR,
        setorDestino: SETOR,
        funcionarioDestinoId: destino,
        enfileirarSeOcupado: true,
        resumo: "x",
        ator: { id: origem, setor: OUTRO_SETOR },
      });
      expect(r.ok && r.value.status).toBe("conflito");
    }
    expect(await atendimentoDe(tel)).toEqual([
      { id: resultado.id, setor: OUTRO_SETOR, funcionario_id: origem, fila_funcionario_id: null },
    ]);
  });

  it("Líder desativado não é escolhido e não derruba a consulta quando há outro ativo no Setor", async () => {
    const antigo = await criarPerfil("Lider Antigo B2", SETOR, "lider_setor");
    await desativar(antigo);
    const atual = await criarPerfil("Lider Atual B2", SETOR, "lider_setor");

    const r = await repositorio.liderDoSetor(SETOR);

    expect(r).toEqual({ ok: true, value: atual });
  });
});

describe("B3 — o cliente mais antigo da Fila passa na frente do novo", () => {
  it("abrir com Funcionário livre e alguém esperando: o antigo assume, o novo espera", async () => {
    const espera = await abrir(null);
    expect(espera.resultado).toMatchObject({ status: "aberto", funcionarioId: null });
    await pausa();
    const livre = await criarPerfil("Livre Fifo B3");

    const novo = await abrir(livre);

    if (novo.resultado.status !== "aberto") throw new Error("esperava aberto");
    expect(novo.resultado.funcionarioId).toBeNull();
    expect(novo.resultado.promovido?.telefone).toBe(espera.telefone);
    expect((await atendimentoDe(espera.telefone))[0].funcionario_id).toBe(livre);
    expect((await atendimentoDe(novo.telefone))[0].funcionario_id).toBeNull();
  });

  it("transferir para Funcionário livre com alguém esperando: o antigo assume, o transferido espera", async () => {
    const espera = await abrir(null);
    await pausa();
    const origem = await criarPerfil("Origem Fifo B3", OUTRO_SETOR);
    const destino = await criarPerfil("Destino Fifo B3");
    const { telefone: tel, resultado } = await abrir(origem, OUTRO_SETOR);
    if (resultado.status !== "aberto") throw new Error("setup");

    const r = await repositorio.transferir({
      atendimentoId: resultado.id,
      origemFuncionarioId: origem,
      setorOrigem: OUTRO_SETOR,
      setorDestino: SETOR,
      funcionarioDestinoId: destino,
      enfileirarSeOcupado: true,
      resumo: "Folha",
      ator: { id: origem, setor: OUTRO_SETOR },
    });

    if (!r.ok || r.value.status !== "transferido") throw new Error("esperava transferido");
    expect(r.value.promovidoNoDestino?.telefone).toBe(espera.telefone);
    expect((await atendimentoDe(espera.telefone))[0].funcionario_id).toBe(destino);
    // O transferido espera na Fila pessoal do destino fixo, atrás de quem já estava.
    expect((await atendimentoDe(tel))[0]).toMatchObject({
      funcionario_id: null,
      fila_funcionario_id: destino,
    });
  });
});

describe("I1 — o crédito mensal sobrevive à Transferência", () => {
  it("quem atendeu e transferiu continua com o crédito; o destino ganha o dele ao assumir", async () => {
    const a = await criarPerfil("Atende B");
    const b = await criarPerfil("Recebe B");
    expect(await creditoDoMes(SETOR, a)).toBe(0);
    const { resultado } = await abrir(a);
    if (resultado.status !== "aberto") throw new Error("setup");
    expect(await creditoDoMes(SETOR, a)).toBe(1);

    const r = await repositorio.transferir({
      atendimentoId: resultado.id,
      origemFuncionarioId: a,
      setorOrigem: SETOR,
      setorDestino: SETOR,
      funcionarioDestinoId: b,
      enfileirarSeOcupado: false,
      resumo: "x",
      ator: { id: a, setor: SETOR },
    });

    expect(r.ok && r.value.status).toBe("transferido");
    expect(await creditoDoMes(SETOR, a)).toBe(1);
    expect(await creditoDoMes(SETOR, b)).toBe(1);
  });

  it("a URA sozinha não gera crédito; a promoção da Fila gera, para quem assume", async () => {
    const espera = await abrir(null);
    expect(espera.resultado).toMatchObject({ funcionarioId: null });
    const sozinha = await atendimentoDe(espera.telefone);
    const { data: creditos } = await admin
      .from("assuncoes_atendimento")
      .select("id")
      .eq("atendimento_id", sozinha[0].id);
    expect(creditos).toEqual([]);

    await pausa();
    const quem = await criarPerfil("Promovido B");
    const antes = await creditoDoMes(SETOR, quem);
    const novo = await abrir(quem);
    expect(novo.resultado).toMatchObject({ status: "aberto", funcionarioId: null });

    expect(await creditoDoMes(SETOR, quem)).toBe(antes + 1);
  });
});
