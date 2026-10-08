/**
 * Integração infra ↔ Supabase (testes.md, seção 3) da leitura e da escrita do painel do
 * Funcionário (#49). Requer `npx supabase start` local com migrations + seed aplicados.
 */
import { createClient } from "@supabase/supabase-js";

import { SupabaseAtendimentoRepository } from "./atendimento.repository";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const repositorio = new SupabaseAtendimentoRepository(admin);

const SETOR = "condominios" as const;
const TELEFONES = ["61955571001", "61955571002", "61955571003"];
const clienteId = crypto.randomUUID();
const CNPJ = `8${Date.now()}`.slice(0, 14);
const usuarios: string[] = [];

async function criarFuncionario(nome: string): Promise<string> {
  const { data } = await admin.auth.admin.createUser({
    email: `painel-49-${nome.replace(/\W/g, "")}-${Date.now()}@teste.local`,
    password: "senha-de-teste-123",
    email_confirm: true,
  });
  const id = data.user!.id;
  usuarios.push(id);
  await admin
    .from("perfis")
    .insert({ id, nome, email: data.user!.email, papel: "funcionario", setor: SETOR });
  return id;
}

async function abrir(telefone: string, funcionarioId: string | null, cliente: string | null) {
  const r = await repositorio.abrir({
    telefone,
    chave: telefone,
    clienteId: cliente,
    setor: SETOR,
    funcionarioId,
    mensagens: [
      { autor: "contato", texto: "preciso do contrato" },
      { autor: "ura", texto: "Já vamos te atender" },
    ],
  });
  if (!r.ok || r.value.status !== "aberto") throw new Error("abertura falhou");
  return r.value.id;
}

beforeAll(async () => {
  const cliente = await admin
    .from("clientes")
    .insert({ id: clienteId, empresa: "Painel Ltda", cnpj: CNPJ, regime: "lucro_presumido" });
  if (cliente.error) throw cliente.error;
  // Dois Contatos: o padrão (outro número) e quem de fato escreve, pelo número do Atendimento.
  const contatos = await admin.from("cliente_contatos").insert([
    {
      id: crypto.randomUUID(),
      cliente_id: clienteId,
      nome: "Dona Padrão",
      telefone: "(61) 95557-9999",
      padrao: true,
    },
    {
      id: crypto.randomUUID(),
      cliente_id: clienteId,
      nome: "Seu Painel",
      telefone: "(61) 95557-1001",
      padrao: false,
    },
  ]);
  if (contatos.error) throw contatos.error;
});

afterAll(async () => {
  await admin.from("atendimentos").delete().in("telefone", TELEFONES);
  await admin.from("clientes").delete().eq("id", clienteId);
  for (const id of usuarios) await admin.auth.admin.deleteUser(id);
});

describe("SupabaseAtendimentoRepository — painel do Funcionário", () => {
  it("lista só os Atendimentos em andamento do Funcionário, com o Contato pelo número do Atendimento", async () => {
    const ana = await criarFuncionario("Ana Painel 49");
    const outro = await criarFuncionario("Outro Painel 49");
    const dela = await abrir(TELEFONES[0], ana, clienteId);
    await abrir(TELEFONES[1], outro, null);

    const lista = await repositorio.emAndamentoDoFuncionario(ana);
    expect(lista).toEqual({
      ok: true,
      value: [
        {
          id: dela,
          telefone: TELEFONES[0],
          criadoEm: expect.any(String),
          contato: { contatoNome: "Seu Painel", empresa: "Painel Ltda", cnpj: CNPJ },
        },
      ],
    });

    await admin.from("atendimentos").update({ status: "encerrado" }).eq("id", dela);
    expect(await repositorio.emAndamentoDoFuncionario(ana)).toEqual({ ok: true, value: [] });
  });

  it("devolve a conversa em ordem, com nome e Setor de quem escreveu cada Mensagem do Funcionário", async () => {
    const bia = await criarFuncionario("Bia Painel 49");
    const id = await abrir(TELEFONES[2], bia, null);
    const gravada = await repositorio.registrarMensagemDoFuncionario(id, bia, "Enviou ao cliente");
    expect(gravada.ok).toBe(true);

    const conversa = await repositorio.conversa(id);
    expect(conversa).toEqual({
      ok: true,
      value: {
        id,
        status: "em_andamento",
        setor: SETOR,
        funcionarioId: bia,
        clienteId: null,
        telefone: TELEFONES[2],
        contato: { contatoNome: null, empresa: null, cnpj: null },
        mensagens: [
          expect.objectContaining({
            autor: "contato",
            texto: "preciso do contrato",
            atendente: null,
          }),
          expect.objectContaining({ autor: "ura", atendente: null }),
          expect.objectContaining({
            autor: "funcionario",
            texto: "Enviou ao cliente",
            atendente: { nome: "Bia Painel 49", setor: SETOR },
          }),
        ],
      },
    });
  });

  it("Atendimento inexistente não é encontrado", async () => {
    expect(await repositorio.conversa(crypto.randomUUID())).toEqual({ ok: true, value: null });
  });
});
