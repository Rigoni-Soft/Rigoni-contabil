/**
 * Integração infra ↔ Supabase (testes.md, seção 3) da Fila de Atendimento (#47).
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

// Setor só desta suíte: a Fila é do Setor inteiro, então nenhuma outra suíte pode usá-lo.
const SETOR = "societario" as const;
const ATOR = (id: string) => ({ id, setor: SETOR });
const TELEFONES = ["61955570001", "61955570002", "61955570003", "61955570004", "61955570005"];
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

async function abrir(
  telefone: string,
  funcionarioId: string | null,
  cliente: string | null = null,
) {
  const r = await repositorio.abrir({
    telefone,
    chave: telefone,
    clienteId: cliente,
    setor: SETOR,
    funcionarioId,
    mensagens: [{ autor: "contato", texto: "oi" }],
  });
  if (!r.ok || r.value.status !== "aberto") throw new Error("abertura falhou");
  return r.value.id;
}

async function pausa() {
  // `fila_desde` usa now() da transação: a ordem só é distinguível entre transações separadas.
  await new Promise((resolve) => setTimeout(resolve, 15));
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

describe("SupabaseAtendimentoRepository — Fila", () => {
  let dono: string;
  let primeiro: string;
  let segundo: string;
  let terceiro: string;

  it("Atendimento sem Funcionário entra na Fila, com posição e com o que já se sabe do Contato", async () => {
    dono = await criarFuncionario("Dono Fila 47");
    const emAtendimento = await abrir(TELEFONES[0], dono);
    expect(await repositorio.posicaoNaFila(emAtendimento)).toEqual({ ok: true, value: null });

    primeiro = await abrir(TELEFONES[1], null, clienteId);
    await pausa();
    segundo = await abrir(TELEFONES[2], null);
    await pausa();
    terceiro = await abrir(TELEFONES[3], null);

    for (const [id, posicao] of [
      [primeiro, 1],
      [segundo, 2],
      [terceiro, 3],
    ] as const) {
      expect(await repositorio.posicaoNaFila(id)).toEqual({ ok: true, value: posicao });
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

  it("ocupado ou com a Fila vazia, liberar não atribui nada", async () => {
    expect(await repositorio.liberarFuncionario(dono, SETOR)).toEqual({ ok: true, value: null });
    const livre = await criarFuncionario("Livre Fila 47");
    const vazia = await repositorio.liberarFuncionario(livre, "contabil");
    expect(vazia).toEqual({ ok: true, value: null });
  });

  it("ao encerrar, o Funcionário assume o cliente mais antigo da Fila e isso soma ao mês dele", async () => {
    const antes = await repositorio.funcionariosDoSetor(SETOR);
    const contagemAntes = antes.ok ? antes.value.find((f) => f.id === dono)!.atendimentosNoMes : -1;

    const emAndamento = await admin
      .from("atendimentos")
      .select("id")
      .eq("funcionario_id", dono)
      .eq("status", "em_andamento")
      .single();
    expect(await repositorio.encerrar(emAndamento.data!.id, dono, ATOR(dono))).toEqual({
      ok: true,
      value: true,
    });
    const auditoria = await admin
      .from("registros_auditoria")
      .select("acao, resultado, ator")
      .eq("alvo", emAndamento.data!.id);
    expect(auditoria.data).toEqual([
      { acao: "atendimento.encerrar", resultado: "sucesso", ator: dono },
    ]);
    // Já encerrado: o dono informado não bate mais com nada em andamento.
    expect(await repositorio.encerrar(emAndamento.data!.id, dono, ATOR(dono))).toEqual({
      ok: true,
      value: false,
    });

    const assumido = await repositorio.liberarFuncionario(dono, SETOR);
    expect(assumido).toEqual({
      ok: true,
      value: {
        id: primeiro,
        telefone: TELEFONES[1],
        chave: TELEFONES[1],
        funcionarioNome: "Dono Fila 47",
      },
    });

    const depois = await repositorio.funcionariosDoSetor(SETOR);
    const dele = depois.ok ? depois.value.find((f) => f.id === dono)! : null;
    expect(dele).toMatchObject({ livre: false, atendimentosNoMes: contagemAntes + 1 });
    // O Atendimento assumido saiu da Fila e a posição dos outros subiu.
    expect(await repositorio.posicaoNaFila(primeiro)).toEqual({ ok: true, value: null });
    expect(await repositorio.posicaoNaFila(segundo)).toEqual({ ok: true, value: 1 });
  });

  it("a Fila de um usuário e a do Setor concorrem por antiguidade, e a dos outros usuários não entra", async () => {
    const alvo = await criarFuncionario("Alvo Fila 47");
    const outro = await criarFuncionario("Outro Fila 47");
    await abrir(TELEFONES[4], alvo);
    await pausa();
    // Entra na Fila de `outro` (ocupado por outro Atendimento): mais novo que o `segundo` do Setor.
    const origem = await criarFuncionario("Origem Fila 47", "recepcao");
    const atendimentoOutro = await abrir(TELEFONES[0], origem);
    const naFilaDeOutro = await admin
      .from("atendimentos")
      .update({
        setor: SETOR,
        funcionario_id: null,
        assumido_em: null,
        fila_funcionario_id: outro,
        fila_desde: new Date(),
      })
      .eq("id", atendimentoOutro);
    expect(naFilaDeOutro.error).toBeNull();

    // `alvo` ocupado: a Fila dele (vazia) e a do Setor não mudam. Liberado, leva o mais antigo.
    const antigo = await admin
      .from("atendimentos")
      .update({ fila_funcionario_id: alvo, fila_desde: new Date("2020-01-01") })
      .eq("id", terceiro);
    expect(antigo.error).toBeNull();

    const emAndamento = await admin
      .from("atendimentos")
      .select("id")
      .eq("funcionario_id", alvo)
      .eq("status", "em_andamento")
      .single();
    await repositorio.encerrar(emAndamento.data!.id, alvo, ATOR(alvo));
    const assumido = await repositorio.liberarFuncionario(alvo, SETOR);
    // O da Fila de `alvo` (desde 2020) é mais antigo que o `segundo` do Setor; o de `outro` fica.
    expect(assumido.ok && assumido.value?.id).toBe(terceiro);
    const fila = await repositorio.filaDoSetor(SETOR);
    expect(fila.ok && fila.value.map((i) => i.id)).toEqual([segundo, atendimentoOutro]);
  });
});
