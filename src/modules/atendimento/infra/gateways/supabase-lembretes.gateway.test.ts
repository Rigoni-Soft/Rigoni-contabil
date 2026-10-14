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
  const cliente = await admin
    .from("clientes")
    .insert({ id: clienteId, empresa: "Lembrete Teste Ltda", cnpj, regime: "simples_nacional" });
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
      cnpj,
      formaEnvio: "whatsapp_e_email",
      documentoObrigatorio: "negativo",
      dasStatus: "pronto",
      contato: { nome: "Ângela", telefone: chave },
      email: null,
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

  it("marca o DAS pronto como enviado com a data e audita com a URA; a segunda vez devolve false", async () => {
    expect(await clientes.marcarDasEnviado(clienteId, "2026-10-05")).toEqual({
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

    expect(await clientes.marcarDasEnviado(clienteId, "2026-10-10")).toEqual({
      ok: true,
      value: false,
    });
  });

  it("grava o alerta do setor e não empilha outro igual enquanto estiver aberto", async () => {
    const alerta = {
      setor: "simples_nacional",
      tipo: "das_pendente",
      clienteId,
      mensagem: "DAS pendente",
    } as const;

    expect((await alertas.alertar(alerta)).ok).toBe(true);
    expect((await alertas.alertar(alerta)).ok).toBe(true);

    const gravados = await admin.from("alertas_setor").select("tipo").eq("cliente_id", clienteId);
    expect(gravados.data).toEqual([{ tipo: "das_pendente" }]);
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
