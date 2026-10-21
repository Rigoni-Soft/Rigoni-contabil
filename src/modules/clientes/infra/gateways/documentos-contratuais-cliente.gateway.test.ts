/**
 * Integração infra ↔ Supabase para a leitura do contrato social e das alterações (#140, S3d/S3e/S5a).
 * Requer `npx supabase start` local com migrations + seed aplicados.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { criarAdminLocal } from "../../../../../test-support/admin-supabase-local";
import { removerClientesDeTeste } from "../../../../../test-support/clientes-de-teste";
import { SupabaseDocumentosContratuaisClienteGateway } from "./documentos-contratuais-cliente.gateway";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const servico = criarAdminLocal(SERVICE_KEY);

async function como(email: string, senha: string): Promise<SupabaseClient> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) throw new Error(`Falha ao autenticar ${email}: ${error.message}`);
  return supabase;
}

const PAPEIS = {
  admin: () => como("admin@rigonicontabil.local", "admin123"),
  liderSN: () => como("lider.sn@rigonicontabil.local", "lider123"),
  responsavel: () => como("funcionario.sn@rigonicontabil.local", "func123"),
  naoResponsavel: () => como("funcionario2.sn@rigonicontabil.local", "func123"),
  liderOutroSetor: () => como("lider.contabil@rigonicontabil.local", "lider123"),
  funcionarioOutroSetor: () => como("funcionario.financeiro@rigonicontabil.local", "func123"),
};
const RESPONSAVEL_ID = "22222222-2222-2222-2222-222222222222";
const CNPJ = "11222333000181";

const clienteId = crypto.randomUUID();
const caminhoContrato = `${clienteId}/contrato-social/contrato.pdf`;
const caminhoAlt1 = `${clienteId}/alteracoes-contratuais/1-a.pdf`;
const caminhoAlt3 = `${clienteId}/alteracoes-contratuais/3-c.pdf`;
const caminhoForaDoPadrao = "fora-do-padrao/arquivo.pdf";
const TODOS = [caminhoContrato, caminhoAlt1, caminhoAlt3, caminhoForaDoPadrao];

async function subir(caminho: string) {
  const { error } = await servico.storage
    .from("documentos-clientes")
    .upload(caminho, new Blob(["%PDF-1.4"], { type: "application/pdf" }), { upsert: true });
  if (error) throw new Error(`upload ${caminho}: ${error.message}`);
}

beforeAll(async () => {
  await removerClientesDeTeste([CNPJ]);
  const criado = await servico.rpc("criar_cliente", {
    p_id: clienteId,
    p_empresa: "Docs Contratuais Ltda",
    p_cnpj: CNPJ,
    p_regime: "simples_nacional",
    p_contrato_social_caminho: caminhoContrato,
    p_alteracoes: [
      { id: crypto.randomUUID(), numero: 1, data: "2024-01-10", arquivoCaminho: caminhoAlt1 },
      { id: crypto.randomUUID(), numero: 3, data: "2025-03-05", arquivoCaminho: caminhoAlt3 },
    ],
  });
  if (criado.error) throw new Error(criado.error.message);
  const resp = await servico
    .from("cliente_cadastro_operacional_sn")
    .update({ responsavel_id: RESPONSAVEL_ID })
    .eq("cliente_id", clienteId);
  if (resp.error) throw new Error(resp.error.message);
  await Promise.all(TODOS.map(subir));
});

afterAll(async () => {
  await servico.storage.from("documentos-clientes").remove(TODOS);
  await removerClientesDeTeste([CNPJ]);
});

describe("SupabaseDocumentosContratuaisClienteGateway (#140, integração)", () => {
  it.each(["admin", "liderSN", "responsavel"] as const)(
    "%s lê contrato e alterações, maior nº primeiro",
    async (papel) => {
      const gateway = new SupabaseDocumentosContratuaisClienteGateway(await PAPEIS[papel]());

      const resultado = await gateway.listar(clienteId);

      expect(resultado.ok).toBe(true);
      if (!resultado.ok) return;
      expect(resultado.value).toEqual([
        { tipo: "alteracao", numero: 3, data: "2025-03-05", caminho: caminhoAlt3 },
        { tipo: "alteracao", numero: 1, data: "2024-01-10", caminho: caminhoAlt1 },
        { tipo: "contrato", numero: null, data: null, caminho: caminhoContrato },
      ]);
    },
  );

  it.each(["naoResponsavel", "liderOutroSetor", "funcionarioOutroSetor"] as const)(
    "%s não lê nada",
    async (papel) => {
      const gateway = new SupabaseDocumentosContratuaisClienteGateway(await PAPEIS[papel]());

      const resultado = await gateway.listar(clienteId);

      expect(resultado).toEqual({ ok: true, value: [] });
    },
  );

  it.each(["admin", "liderSN", "responsavel"] as const)(
    "%s gera link assinado do objeto do Cliente",
    async (papel) => {
      const gateway = new SupabaseDocumentosContratuaisClienteGateway(await PAPEIS[papel]());

      const link = await gateway.linkTemporario(caminhoAlt3, 120);

      expect(link.ok).toBe(true);
      if (link.ok) expect(link.value).toContain("/object/sign/documentos-clientes/");
    },
  );

  it.each(["naoResponsavel", "liderOutroSetor", "funcionarioOutroSetor"] as const)(
    "%s não gera link assinado",
    async (papel) => {
      const gateway = new SupabaseDocumentosContratuaisClienteGateway(await PAPEIS[papel]());

      const link = await gateway.linkTemporario(caminhoAlt3, 120);

      expect(link.ok).toBe(false);
    },
  );

  it("objeto fora do padrão {uuid}/... só o Admin lê (cast seguro, sem erro)", async () => {
    const admin = new SupabaseDocumentosContratuaisClienteGateway(await PAPEIS.admin());
    const lider = new SupabaseDocumentosContratuaisClienteGateway(await PAPEIS.liderSN());

    expect((await admin.linkTemporario(caminhoForaDoPadrao, 120)).ok).toBe(true);
    expect((await lider.linkTemporario(caminhoForaDoPadrao, 120)).ok).toBe(false);
  });

  it("Responsável em primeiro acesso (sem acesso_liberado) não lê nem gera link (S3d)", async () => {
    const email = `teste-primeiro-acesso-${crypto.randomUUID()}@rigonicontabil.local`;
    const senha = "senha-provisoria-123";
    const criada = await servico.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
    });
    if (criada.error || !criada.data.user) throw new Error(criada.error?.message);
    const contaId = criada.data.user.id;
    try {
      const perfil = await servico.from("perfis").insert({
        id: contaId,
        nome: "Funcionário Primeiro Acesso",
        email,
        papel: "funcionario",
        setor: "simples_nacional",
        senha_trocada_em: null,
        senha_provisoria_expira_em: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      });
      if (perfil.error) throw new Error(perfil.error.message);
      const atribuicao = await servico
        .from("cliente_cadastro_operacional_sn")
        .update({ responsavel_id: contaId })
        .eq("cliente_id", clienteId);
      if (atribuicao.error) throw new Error(atribuicao.error.message);
      const gateway = new SupabaseDocumentosContratuaisClienteGateway(await como(email, senha));

      expect(await gateway.listar(clienteId)).toEqual({ ok: true, value: [] });
      expect((await gateway.linkTemporario(caminhoAlt3, 120)).ok).toBe(false);
    } finally {
      await servico
        .from("cliente_cadastro_operacional_sn")
        .update({ responsavel_id: RESPONSAVEL_ID })
        .eq("cliente_id", clienteId);
      await servico.from("perfis").delete().eq("id", contaId);
      await servico.auth.admin.deleteUser(contaId);
    }
  });
});
