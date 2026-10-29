/**
 * Integração infra ↔ Supabase (testes.md, seção 3) do encerramento automático por silêncio do
 * cliente. Requer `npx supabase start` local com migrations + seed aplicados.
 */
import { createClient } from "@supabase/supabase-js";

import { URA_ATOR_ID } from "@/modules/atendimento/domain/services/encerramento-automatico.service";

import { abrirComDono } from "../../../../../test-support/atendimento-com-dono";
import { exigirSupabaseLocal } from "../../../../../test-support/exigir-supabase-local";
import { SupabaseAtendimentoRepository } from "./atendimento.repository";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

// Antes de qualquer setup destrutivo.
exigirSupabaseLocal(SUPABASE_URL);

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const repositorio = new SupabaseAtendimentoRepository(admin);
const atendimentosCriados: string[] = [];
const usuarios: string[] = [];

const SETOR = "administrativo" as const;
const TELEFONES = [
  "61955591001",
  "61955591002",
  "61955591003",
  "61955591004",
  "61955591005",
  "61955591006",
  "61955591007",
];

const HORA = 3_600_000;
const horasAtras = (h: number) => new Date(Date.now() - h * HORA);
// O corte do caso de uso: 23h50 antes de agora.
const corte = () => new Date(Date.now() - (23 * HORA + 50 * 60_000));

async function criarFuncionario(): Promise<string> {
  const { data } = await admin.auth.admin.createUser({
    email: `silencio-167-${Date.now()}-${usuarios.length}@teste.local`,
    password: "senha-de-teste-123",
    email_confirm: true,
  });
  const id = data.user!.id;
  usuarios.push(id);
  await admin.from("perfis").insert({
    id,
    nome: "Func Silêncio",
    email: data.user!.email,
    papel: "funcionario",
    setor: SETOR,
  });
  return id;
}

// Atendimento com dono; a Mensagem do cliente e a do Funcionário (se houver) com as idades dadas.
async function abrir(
  telefone: string,
  opcoes: { semDono?: boolean; contatoHa: number; funcionarioHa?: number },
): Promise<string> {
  const abertura = {
    telefone,
    chave: telefone,
    clienteId: null,
    setor: SETOR,
    mensagens: [{ autor: "contato" as const, texto: "oi" }],
  };
  let id: string;
  if (opcoes.semDono) {
    const r = await repositorio.abrir(abertura);
    if (!r.ok) throw new Error("abertura falhou");
    id = r.value.id;
  } else {
    id = await abrirComDono(admin, repositorio, abertura, await criarFuncionario());
  }
  atendimentosCriados.push(id);
  await admin
    .from("mensagens")
    .update({ criado_em: horasAtras(opcoes.contatoHa).toISOString() })
    .eq("atendimento_id", id)
    .eq("autor", "contato");
  if (opcoes.funcionarioHa !== undefined) {
    await admin.from("mensagens").insert({
      atendimento_id: id,
      autor: "funcionario",
      texto: "resposta",
      entrega: "entregue",
      criado_em: horasAtras(opcoes.funcionarioHa).toISOString(),
    });
  }
  return id;
}

async function status(id: string) {
  const { data } = await admin.from("atendimentos").select("status").eq("id", id).single();
  return data?.status;
}

async function auditorias(id: string) {
  const { data } = await admin
    .from("registros_auditoria")
    .select("ator, setor, acao, resultado")
    .eq("alvo", id);
  return data;
}

afterAll(async () => {
  await admin.from("atendimentos").delete().in("telefone", TELEFONES);
  if (atendimentosCriados.length > 0) {
    await admin.from("registros_auditoria").delete().in("alvo", atendimentosCriados);
  }
  for (const id of usuarios) await admin.auth.admin.deleteUser(id);
});

describe("SupabaseAtendimentoRepository — encerramento automático por silêncio do cliente", () => {
  it("encerra o Atendimento cujo cliente passou de 23h50 calado, com o sistema como ator", async () => {
    const id = await abrir(TELEFONES[0], { contatoHa: 24 });

    const resultado = await repositorio.encerrarSemRespostaDoCliente(corte(), URA_ATOR_ID);

    expect(resultado).toEqual({ ok: true, value: expect.any(Number) });
    expect(await status(id)).toBe("encerrado");
    expect(await auditorias(id)).toEqual([
      { ator: URA_ATOR_ID, setor: SETOR, acao: "atendimento.encerrar", resultado: "sucesso" },
    ]);
  });

  it("mensagem recente do Funcionário não adia o encerramento", async () => {
    const id = await abrir(TELEFONES[1], { contatoHa: 30, funcionarioHa: 1 });

    await repositorio.encerrarSemRespostaDoCliente(corte(), URA_ATOR_ID);

    expect(await status(id)).toBe("encerrado");
  });

  it("mensagem do cliente dentro das 23h50 mantém o Atendimento em andamento", async () => {
    const id = await abrir(TELEFONES[2], { contatoHa: 23 });

    await repositorio.encerrarSemRespostaDoCliente(corte(), URA_ATOR_ID);

    expect(await status(id)).toBe("em_andamento");
    expect(await auditorias(id)).toEqual([]);
  });

  it("não encerra quem ainda espera na fila (sem Funcionário)", async () => {
    const id = await abrir(TELEFONES[3], { semDono: true, contatoHa: 48 });

    await repositorio.encerrarSemRespostaDoCliente(corte(), URA_ATOR_ID);

    expect(await status(id)).toBe("em_andamento");
  });

  it("uma segunda rodada não encerra nem audita de novo", async () => {
    const id = await abrir(TELEFONES[4], { contatoHa: 25 });
    await repositorio.encerrarSemRespostaDoCliente(corte(), URA_ATOR_ID);

    await repositorio.encerrarSemRespostaDoCliente(corte(), URA_ATOR_ID);

    expect(await auditorias(id)).toHaveLength(1);
  });

  it("sem nenhuma Mensagem do cliente, conta desde a abertura do Atendimento", async () => {
    const id = await abrir(TELEFONES[6], { contatoHa: 1 });
    await admin.from("mensagens").delete().eq("atendimento_id", id);
    await admin
      .from("atendimentos")
      .update({ criado_em: horasAtras(30).toISOString() })
      .eq("id", id);

    await repositorio.encerrarSemRespostaDoCliente(corte(), URA_ATOR_ID);

    expect(await status(id)).toBe("encerrado");
  });

  it("devolve quantos encerrou nesta rodada", async () => {
    await abrir(TELEFONES[5], { contatoHa: 26 });

    const resultado = await repositorio.encerrarSemRespostaDoCliente(corte(), URA_ATOR_ID);

    expect(resultado.ok && resultado.value).toBeGreaterThanOrEqual(1);
  });
});
