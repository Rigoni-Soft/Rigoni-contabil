/**
 * Integração infra ↔ Supabase (testes.md, seção 3) da leitura e da escrita do painel do
 * Funcionário. Requer `npx supabase start` local com migrations + seed aplicados.
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

const SETOR = "condominios" as const;
const TELEFONES = [
  "61955571001",
  "61955571002",
  "61955571003",
  "61955571004",
  "61955571005",
  "61955571006",
  "61955571007",
  "61955571008",
  "61955571009",
  "61955571010",
];
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
  const abertura = {
    telefone,
    chave: telefone,
    clienteId: cliente,
    setor: SETOR,
    mensagens: [
      { autor: "contato" as const, texto: "preciso do contrato" },
      { autor: "ura" as const, texto: "Já vamos te atender" },
    ],
  };
  if (funcionarioId) return abrirComDono(admin, repositorio, abertura, funcionarioId);
  const r = await repositorio.abrir(abertura);
  if (!r.ok) throw new Error("abertura falhou");
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
          // A mais recente das duas mensagens da abertura (a da URA).
          ultimaMensagem: {
            autor: "ura",
            texto: "Já vamos te atender",
            criadoEm: expect.any(String),
            anexoTipo: null,
          },
        },
      ],
    });

    await admin.from("atendimentos").update({ status: "encerrado" }).eq("id", dela);
    expect(await repositorio.emAndamentoDoFuncionario(ana)).toEqual({ ok: true, value: [] });
  });

  it("devolve a conversa em ordem, com nome e Setor de quem escreveu cada Mensagem do Funcionário", async () => {
    const bia = await criarFuncionario("Bia Painel 49");
    const id = await abrir(TELEFONES[2], bia, null);
    const gravada = await repositorio.registrarMensagemDoFuncionario(
      id,
      { id: bia },
      "Enviou ao cliente",
    );
    expect(gravada.ok && gravada.value.status).toBe("registrada");

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
        temMaisAntigas: false,
        ultimaDoFuncionarioEm: null,
        ultimaTransferencia: null,
        ura: null,
        aviso: null,
      },
    });
  });

  it("a conversa traz a última Transferência: Setor e nome de origem e o resumo", async () => {
    const caio = await criarFuncionario("Caio Painel 49");
    const dani = await criarFuncionario("Dani Painel 49");
    const id = await abrir(TELEFONES[3], dani, null);
    const grava = (origem: string | null, resumo: string, criadoEm: string) =>
      admin.from("transferencias").insert({
        atendimento_id: id,
        setor_origem: "recepcao",
        funcionario_origem_id: origem,
        setor_destino: SETOR,
        funcionario_destino_id: dani,
        resumo,
        criado_em: criadoEm,
      });
    await grava(caio, "primeiro assunto", "2026-10-01T10:00:00Z");
    await grava(caio, "Dúvida no DAS", "2026-10-02T10:00:00Z");

    const conversa = await repositorio.conversa(id);
    expect(conversa.ok && conversa.value?.ultimaTransferencia).toEqual({
      setorOrigem: "recepcao",
      origemNome: "Caio Painel 49",
      resumo: "Dúvida no DAS",
    });
  });

  it("a conversa traz o resumo da URA e o CNPJ informado do Atendimento sem Cliente", async () => {
    const edu = await criarFuncionario("Edu Painel 49");
    const id = await abrir(TELEFONES[4], edu, null);
    await admin
      .from("atendimentos")
      .update({ resumo_ura: "Quer abrir uma empresa", cnpj_informado: "11444777000161" })
      .eq("id", id);

    const conversa = await repositorio.conversa(id);
    expect(conversa.ok && conversa.value?.ura).toEqual({
      resumo: "Quer abrir uma empresa",
      cnpjInformado: "11444777000161",
    });
  });

  it("Mensagem com anexo guarda legenda e anexo (#79): a conversa e a lista do dock os trazem", async () => {
    const fabi = await criarFuncionario("Fabi Painel 79");
    const id = await abrir(TELEFONES[5], fabi, null);
    const anexo = {
      tipo: "documento" as const,
      nome: "balanço.pdf",
      tamanho: 2048,
      caminho: `${id}/u/balanco.pdf`,
      miniaturaCaminho: `${id}/u/miniatura.webp`,
    };

    const gravada = await repositorio.registrarMensagemDoFuncionario(
      id,
      { id: fabi },
      "Segue",
      anexo,
    );
    expect(gravada.ok && gravada.value.status).toBe("registrada");

    const conversa = await repositorio.conversa(id);
    expect(conversa.ok && conversa.value?.mensagens.at(-1)).toEqual(
      expect.objectContaining({ autor: "funcionario", texto: "Segue", anexo }),
    );
    expect(conversa.ok && conversa.value?.mensagens[0].anexo).toBeNull();
    const lista = await repositorio.emAndamentoDoFuncionario(fabi);
    expect(lista.ok && lista.value[0].ultimaMensagem).toEqual(
      expect.objectContaining({ texto: "Segue", anexoTipo: "documento" }),
    );
  });

  it("o banco recusa anexo incompleto (os quatro campos nascem juntos)", async () => {
    const gil = await criarFuncionario("Gil Painel 79");
    const id = await abrir(TELEFONES[6], gil, null);

    const { error } = await admin.from("mensagens").insert({
      atendimento_id: id,
      autor: "funcionario",
      funcionario_id: gil,
      texto: "",
      anexo_tipo: "imagem",
    });

    expect(error?.message).toMatch(/mensagens_anexo_completo/);
  });

  it("mensagensPorId devolve só as Mensagens pedidas do Atendimento (outro id é ignorado) com anexo e entrega", async () => {
    const hugo = await criarFuncionario("Hugo Painel 85");
    const id = await abrir(TELEFONES[7], hugo, null);
    const outro = await abrir(TELEFONES[8], await criarFuncionario("Ivo Painel 85"), null);
    const anexo = {
      tipo: "documento" as const,
      nome: "balanco.pdf",
      tamanho: 2048,
      caminho: `${id}/u/balanco.pdf`,
      miniaturaCaminho: null,
    };
    const gravada = await repositorio.registrarMensagemDoFuncionario(
      id,
      { id: hugo },
      "Segue",
      anexo,
    );
    if (!gravada.ok || gravada.value.status !== "registrada") throw new Error("registro falhou");
    const doOutro = await admin.from("mensagens").select("id").eq("atendimento_id", outro).limit(1);

    const lidas = await repositorio.mensagensPorId(id, [
      gravada.value.id,
      doOutro.data![0].id,
      crypto.randomUUID(),
    ]);

    expect(lidas.ok && lidas.value?.mensagens.map((m) => m.id)).toEqual([gravada.value.id]);
    expect(lidas.ok && lidas.value?.mensagens[0]).toMatchObject({
      anexo: { caminho: anexo.caminho },
      entrega: "pendente",
    });
    expect(lidas.ok && lidas.value).toMatchObject({ setor: SETOR, funcionarioId: hugo });
    expect(await repositorio.mensagensPorId(crypto.randomUUID(), [gravada.value.id])).toEqual({
      ok: true,
      value: null,
    });
  });

  it("finalizarEntregaDoFuncionario fecha a Mensagem e ela passa a contar na última do Funcionário", async () => {
    const id = await abrir(TELEFONES[9], await criarFuncionario("Joel Painel 85"), null);
    const joel = (await admin.from("atendimentos").select("funcionario_id").eq("id", id).single())
      .data!.funcionario_id as string;
    const gravada = await repositorio.registrarMensagemDoFuncionario(id, { id: joel }, "oi");
    if (!gravada.ok || gravada.value.status !== "registrada") throw new Error("registro falhou");

    const antes = await repositorio.conversa(id);
    expect(antes.ok && antes.value?.mensagens.at(-1)?.entrega).toBe("pendente");

    await repositorio.finalizarEntregaDoFuncionario(gravada.value.id, true);
    const depois = await repositorio.conversa(id);
    expect(depois.ok && depois.value?.mensagens.at(-1)?.entrega).toBe("entregue");
  });

  it("Atendimento inexistente não é encontrado", async () => {
    expect(await repositorio.conversa(crypto.randomUUID())).toEqual({ ok: true, value: null });
  });
});
