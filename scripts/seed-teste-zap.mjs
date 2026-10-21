// Cria o Cliente "Teste Zap" (teste de ponta a ponta com o WhatsApp real) do mesmo jeito que o
// cadastro do app: PDFs no bucket `documentos-clientes`, caminhos gravados pela RPC `criar_cliente`
// (contrato social no cliente, alteração na tabela própria) e os contatos. Idempotente.
// Roda depois do `db reset` da homologação (e2e-preview.yml) ou à mão:
//   node --env-file=.env.local scripts/seed-teste-zap.mjs
// Só aceita o Supabase local ou o projeto de homologação (SUPABASE_HOMOLOG_PROJECT_REF).
import { readFile } from "node:fs/promises";

import { createClient } from "@supabase/supabase-js";

const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: chave } = process.env;
const refHomolog = process.env.SUPABASE_HOMOLOG_PROJECT_REF;

const local = /^[a-z]+:\/\/(127\.0\.0\.1|localhost)([:/]|$)/.test(url ?? "");
if (!url || !chave || !(local || (refHomolog && url === `https://${refHomolog}.supabase.co`))) {
  throw new Error("Recusado: só roda contra o Supabase local ou o projeto de homologação.");
}

const ID = "5b1f4f4e-6a0c-4c1e-9d0a-1c2d3e4f5a61";
const CNPJ = "90000010000110"; // fictício, com dígitos verificadores válidos
const BUCKET = "documentos-clientes";
const ARQUIVOS = new URL("../supabase/arquivos-seed/", import.meta.url);
const CONTRATO = `${ID}/contrato-social/contrato-social.pdf`;
const ALTERACAO = `${ID}/alteracoes-contratuais/1-alteracao-contratual.pdf`;

const supabase = createClient(url, chave, { auth: { persistSession: false } });
const falhou = (etapa, error) => {
  if (error) throw new Error(`${etapa}: ${error.message}`);
};

for (const [caminho, nome] of [
  [CONTRATO, "contrato-social.pdf"],
  [ALTERACAO, "alteracao-contratual.pdf"],
]) {
  // remove + upload (sem `upsert`): é o que o app faz, e o ON CONFLICT do upsert falha no Storage local.
  await supabase.storage.from(BUCKET).remove([caminho]);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(caminho, await readFile(new URL(nome, ARQUIVOS)), { contentType: "application/pdf" });
  falhou(`upload ${nome}`, error);
}

const { data: existente, error: erroBusca } = await supabase
  .from("clientes")
  .select("id")
  .eq("cnpj", CNPJ)
  .maybeSingle();
falhou("busca", erroBusca);

if (!existente) {
  const criado = await supabase.rpc("criar_cliente", {
    p_id: ID,
    p_empresa: "Teste Zap",
    p_cnpj: CNPJ,
    p_regime: "simples_nacional",
    p_contrato_social_caminho: CONTRATO,
    p_email: null,
    p_alteracoes: [{ id: crypto.randomUUID(), numero: 1, data: "2026-01-07", arquivoCaminho: ALTERACAO }],
  });
  falhou("criar_cliente", criado.error);

  const contatos = await supabase.from("cliente_contatos").insert([
    {
      id: crypto.randomUUID(),
      cliente_id: ID,
      nome: "Cledson",
      telefone: "(45) 99832-4311",
      padrao: true,
    },
    {
      id: crypto.randomUUID(),
      cliente_id: ID,
      nome: "Patriki",
      telefone: "(45) 98821-2366",
      padrao: false,
    },
  ]);
  falhou("contatos", contatos.error);
}

console.log(`Teste Zap ${existente ? "já existia" : "criado"} (${url}).`);
