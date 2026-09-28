/**
 * Integração infra ↔ Supabase Storage (testes.md, seção 3): requer
 * `npx supabase start` local com as migrations aplicadas (bucket
 * `documentos-clientes` e as policies de storage.objects deste ticket).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { SupabaseArquivoStorageGateway } from "./supabase-arquivo-storage.gateway";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

async function clienteAutenticado(email: string, senha: string): Promise<SupabaseClient> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) throw new Error(`Falha ao autenticar ${email}: ${error.message}`);
  return supabase;
}

const comoAdmin = () => clienteAutenticado("admin@rigonicontabil.local", "admin123");
const comoFuncionarioSN = () =>
  clienteAutenticado("funcionario.sn@rigonicontabil.local", "func123");

function arquivo(): File {
  return new File(["conteúdo de teste"], "doc.pdf", { type: "application/pdf" });
}

describe("SupabaseArquivoStorageGateway (integração)", () => {
  it("Admin envia um arquivo pro bucket documentos-clientes", async () => {
    const supabase = await comoAdmin();
    const gateway = new SupabaseArquivoStorageGateway(supabase);
    const caminho = `${crypto.randomUUID()}/contrato-social/doc.pdf`;

    const resultado = await gateway.enviar(caminho, arquivo());

    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.value.caminho).toBe(caminho);
  });

  it("Funcionário não pode enviar arquivo pro bucket (RLS)", async () => {
    const supabase = await comoFuncionarioSN();
    const gateway = new SupabaseArquivoStorageGateway(supabase);

    const resultado = await gateway.enviar(
      `${crypto.randomUUID()}/contrato-social/doc.pdf`,
      arquivo(),
    );

    expect(resultado.ok).toBe(false);
  });
});
