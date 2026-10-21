/**
 * Integração infra ↔ Supabase (testes.md, seção 3) da entrega de documentos contratuais.
 * Requer `npx supabase start` local com migrations + seed aplicados.
 */
import { createClient } from "@supabase/supabase-js";

import { SupabaseDocumentosContratuaisGateway } from "./supabase-documentos-contratuais.gateway";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const gateway = new SupabaseDocumentosContratuaisGateway(admin);

const clienteId = crypto.randomUUID();
const semDocumentosId = crypto.randomUUID();
const contrato = `${clienteId}/contrato.pdf`;
const alteracaoNova = `${clienteId}/alt-nova.pdf`;
const alteracaoAntiga = `${clienteId}/alt-antiga.pdf`;

beforeAll(async () => {
  const clientes = await admin.from("clientes").insert([
    {
      id: clienteId,
      empresa: "Docs Teste Ltda",
      cnpj: `8${Date.now()}`.slice(0, 14),
      regime: "simples_nacional",
      contrato_social_caminho: contrato,
    },
    {
      id: semDocumentosId,
      empresa: "Sem Docs Ltda",
      cnpj: `7${Date.now()}`.slice(0, 14),
      regime: "simples_nacional",
    },
  ]);
  if (clientes.error) throw clientes.error;
  // Inseridas fora de ordem: a listagem tem que ordenar por data.
  const alteracoes = await admin.from("cliente_alteracoes_contratuais").insert([
    {
      id: crypto.randomUUID(),
      cliente_id: clienteId,
      numero: 2,
      data: "2022-11-01",
      arquivo_caminho: alteracaoNova,
    },
    {
      id: crypto.randomUUID(),
      cliente_id: clienteId,
      numero: 1,
      data: "2020-03-12",
      arquivo_caminho: alteracaoAntiga,
    },
  ]);
  if (alteracoes.error) throw alteracoes.error;
  const upload = await admin.storage
    .from("documentos-clientes")
    .upload(contrato, new Blob(["%PDF-1.4 teste"], { type: "application/pdf" }));
  if (upload.error) throw upload.error;
});

afterAll(async () => {
  await admin.storage.from("documentos-clientes").remove([contrato]);
  await admin.from("clientes").delete().in("id", [clienteId, semDocumentosId]);
});

describe("SupabaseDocumentosContratuaisGateway", () => {
  it("lista o contrato social e depois as alterações da mais antiga para a mais nova", async () => {
    const r = await gateway.listar(clienteId);
    expect(r).toEqual({
      ok: true,
      value: [
        { tipo: "contrato", data: null, caminho: contrato },
        { tipo: "alteracao", data: "2020-03-12", caminho: alteracaoAntiga },
        { tipo: "alteracao", data: "2022-11-01", caminho: alteracaoNova },
      ],
    });
  });

  it("Cliente sem documentos devolve lista vazia", async () => {
    expect(await gateway.listar(semDocumentosId)).toEqual({ ok: true, value: [] });
  });

  it("gera um link temporário que baixa o arquivo real do Storage", async () => {
    const r = await gateway.linkTemporario(contrato);
    if (!r.ok) throw r.error;
    const resposta = await fetch(r.value);
    expect(resposta.status).toBe(200);
    expect(await resposta.text()).toContain("%PDF-1.4");
  });
});
