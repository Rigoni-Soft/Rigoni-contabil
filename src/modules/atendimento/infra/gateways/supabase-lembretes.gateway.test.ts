/**
 * Integração infra ↔ Supabase (testes.md, seção 3) do job de lembrete de documento e DAS (#52):
 * leitura dos Clientes, DAS enviado com auditoria da URA, alertas ao setor e guia publicada.
 * Requer `npx supabase start` local com migrations aplicadas.
 */
import { createClient } from "@supabase/supabase-js";

import { URA_ATOR_ID } from "@/modules/atendimento/domain/services/inatividade.service";

import { SupabaseAlertaSetorGateway } from "./supabase-alerta-setor.gateway";
import { SupabaseClientesParaLembreteGateway } from "./supabase-clientes-para-lembrete.gateway";
import { SupabaseGuiaPublicadaGateway } from "./supabase-guia-publicada.gateway";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const clientes = new SupabaseClientesParaLembreteGateway(admin);
const alertas = new SupabaseAlertaSetorGateway(admin);
const guias = new SupabaseGuiaPublicadaGateway(admin);

const clienteId = crypto.randomUUID();
const cnpj = `7${Date.now()}`.slice(0, 14);
// Dígitos únicos por execução: a chave de telefone dos Atendimentos é global.
const sufixo = String(Date.now()).slice(-8);
const telefoneMascarado = `(11) 9${sufixo.slice(0, 4)}-${sufixo.slice(4)}`;
const chave = `55119${sufixo}`;

beforeAll(async () => {
  const cliente = await admin.from("clientes").insert({
    id: clienteId,
    empresa: "Lembrete Teste Ltda",
    cnpj,
    regime: "simples_nacional",
    email: "financeiro@lembrete.test",
  });
  if (cliente.error) throw cliente.error;
  const cadastro = await admin.from("cliente_cadastro_operacional_sn").upsert({
    cliente_id: clienteId,
    forma_envio: "whatsapp_e_email",
    documento_obrigatorio: "negativo",
    das_status: "pronto",
  });
  if (cadastro.error) throw cadastro.error;
  const contato = await admin.from("cliente_contatos").insert({
    id: crypto.randomUUID(),
    cliente_id: clienteId,
    nome: "Ângela",
    telefone: telefoneMascarado,
    padrao: true,
  });
  if (contato.error) throw contato.error;
});

afterAll(async () => {
  await admin.from("atendimentos").delete().eq("chave_telefone", chave);
  await admin.from("registros_auditoria").delete().eq("alvo", cnpj);
  await admin.from("clientes").delete().eq("id", clienteId);
});

describe("job de lembrete de documento e DAS (infra)", () => {
  it("lista o Cliente com o contato padrão (telefone com 55) e sem mensagem do contato", async () => {
    const lista = await clientes.listar();

    expect(lista.ok).toBe(true);
    const encontrado = lista.ok && lista.value.find((c) => c.clienteId === clienteId);
    expect(encontrado).toMatchObject({
      email: "financeiro@lembrete.test",
      dataEnvioDas: null,
      formaEnvio: "whatsapp_e_email",
      documentoObrigatorio: "negativo",
      dasStatus: "pronto",
      contato: { nome: "Ângela", telefone: chave },
      ultimaMensagemDoContatoEm: null,
    });
  });

  it("traz a última Mensagem do contato nos Atendimentos do telefone", async () => {
    const atendimento = await admin
      .from("atendimentos")
      .insert({ telefone: chave, chave_telefone: chave, cliente_id: clienteId, setor: "recepcao" })
      .select("id")
      .single();
    if (atendimento.error) throw atendimento.error;
    const mensagens = await admin.from("mensagens").insert([
      { atendimento_id: atendimento.data.id, autor: "contato", texto: "oi" },
      { atendimento_id: atendimento.data.id, autor: "ura", texto: "resposta" },
    ]);
    if (mensagens.error) throw mensagens.error;

    const lista = await clientes.listar();

    const encontrado = lista.ok && lista.value.find((c) => c.clienteId === clienteId);
    expect(encontrado && encontrado.ultimaMensagemDoContatoEm).toBeInstanceOf(Date);
  });

  it("reivindica o DAS pronto com a data e audita com a URA; a segunda vez devolve false", async () => {
    expect(await clientes.reivindicarDas(clienteId, "2026-10-05")).toEqual({
      ok: true,
      value: true,
    });

    const cadastro = await admin
      .from("cliente_cadastro_operacional_sn")
      .select("das_status, data_envio_das")
      .eq("cliente_id", clienteId)
      .single();
    expect(cadastro.data).toEqual({ das_status: "enviado", data_envio_das: "2026-10-05" });
    const auditoria = await admin
      .from("registros_auditoria")
      .select("ator, setor, acao, resultado")
      .eq("alvo", cnpj);
    expect(auditoria.data).toEqual([
      {
        ator: URA_ATOR_ID,
        setor: "simples_nacional",
        acao: "cliente.enviar-das-automatico",
        resultado: "sucesso",
      },
    ]);

    expect(await clientes.reivindicarDas(clienteId, "2026-10-10")).toEqual({
      ok: true,
      value: false,
    });
  });

  it("desfaz a reivindicação: volta a pronto com a data anterior e registra o desfazer", async () => {
    expect(await clientes.desfazerDas(clienteId, null)).toEqual({ ok: true, value: undefined });

    const cadastro = await admin
      .from("cliente_cadastro_operacional_sn")
      .select("das_status, data_envio_das")
      .eq("cliente_id", clienteId)
      .single();
    expect(cadastro.data).toEqual({ das_status: "pronto", data_envio_das: null });
    const auditoria = await admin
      .from("registros_auditoria")
      .select("acao")
      .eq("alvo", cnpj)
      .order("criado_em");
    expect(auditoria.data).toEqual([
      { acao: "cliente.enviar-das-automatico" },
      { acao: "cliente.desfazer-envio-das-automatico" },
    ]);
  });

  it("repetir o alerta renova a mensagem em vez de empilhar, e o não renovado é resolvido", async () => {
    const alerta = {
      setor: "simples_nacional",
      tipo: "das_pendente",
      clienteId,
      mensagem: "primeira",
    } as const;

    expect((await alertas.alertar(alerta)).ok).toBe(true);
    expect((await alertas.alertar({ ...alerta, mensagem: "segunda" })).ok).toBe(true);

    const abertos = await admin
      .from("alertas_setor")
      .select("mensagem")
      .eq("cliente_id", clienteId)
      .is("resolvido_em", null);
    expect(abertos.data).toEqual([{ mensagem: "segunda" }]);

    // Renovado depois de "desde": continua aberto. Antes dele: resolvido.
    await alertas.resolverNaoRenovados(new Date(Date.now() - 60_000));
    const ainda = await admin
      .from("alertas_setor")
      .select("id")
      .eq("cliente_id", clienteId)
      .is("resolvido_em", null);
    expect(ainda.data).toHaveLength(1);

    await alertas.resolverNaoRenovados(new Date(Date.now() + 60_000));
    const resolvido = await admin
      .from("alertas_setor")
      .select("id")
      .eq("cliente_id", clienteId)
      .is("resolvido_em", null);
    expect(resolvido.data).toHaveLength(0);

    // Resolvido: o mesmo problema volta como alerta novo.
    expect((await alertas.alertar(alerta)).ok).toBe(true);
    const todos = await admin.from("alertas_setor").select("id").eq("cliente_id", clienteId);
    expect(todos.data).toHaveLength(2);
  });

  it("a entrega parcial não é resolvida pelo job; os demais alertas não renovados são", async () => {
    await admin.from("alertas_setor").delete().eq("cliente_id", clienteId);
    const base = { setor: "simples_nacional", clienteId, mensagem: "x" } as const;
    await alertas.alertar({ ...base, tipo: "entrega_parcial" });
    await alertas.alertar({ ...base, tipo: "falha_envio" });

    await alertas.resolverNaoRenovados(new Date(Date.now() + 60_000));

    const abertos = await admin
      .from("alertas_setor")
      .select("tipo")
      .eq("cliente_id", clienteId)
      .is("resolvido_em", null);
    expect(abertos.data).toEqual([{ tipo: "entrega_parcial" }]);
  });

  it("publica o PDF no bucket e devolve um link assinado", async () => {
    const link = await guias.publicar(clienteId, {
      nomeArquivo: "das.pdf",
      pdfBase64: Buffer.from("%PDF-1.4 teste").toString("base64"),
    });

    expect(link.ok && link.value).toContain("/guias-fiscais/");
    const baixado = await fetch(link.ok ? link.value : "");
    expect(baixado.status).toBe(200);
    expect(await baixado.text()).toBe("%PDF-1.4 teste");
  });
});
