/**
 * Integração infra ↔ Supabase Storage (testes.md, seção 3): requer
 * `npx supabase start` local com as migrations aplicadas (bucket
 * `documentos-clientes` e as policies de storage.objects).
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

  it("Admin remove os arquivos enviados (compensação) e eles somem do bucket", async () => {
    const supabase = await comoAdmin();
    const gateway = new SupabaseArquivoStorageGateway(supabase);
    const base = crypto.randomUUID();
    const caminhos = [`${base}/contrato-social/a.pdf`, `${base}/alteracoes-contratuais/0-b.pdf`];
    for (const caminho of caminhos) await gateway.enviar(caminho, arquivo());

    const resultado = await gateway.remover(caminhos);

    expect(resultado.ok).toBe(true);
    const { data } = await supabase.storage.from("documentos-clientes").list(base);
    expect(data ?? []).toHaveLength(0);
  });

  it("remover só é ok se TODOS foram removidos (caminho inexistente = erro)", async () => {
    const supabase = await comoAdmin();
    const gateway = new SupabaseArquivoStorageGateway(supabase);

    const resultado = await gateway.remover([`${crypto.randomUUID()}/nao-existe.pdf`]);

    expect(resultado.ok).toBe(false);
  });

  it("Funcionário não consegue remover arquivo do bucket (RLS de DELETE)", async () => {
    const admin = new SupabaseArquivoStorageGateway(await comoAdmin());
    const caminho = `${crypto.randomUUID()}/contrato-social/doc.pdf`;
    await admin.enviar(caminho, arquivo());

    const resultado = await new SupabaseArquivoStorageGateway(await comoFuncionarioSN()).remover([
      caminho,
    ]);

    expect(resultado.ok).toBe(false);
    await admin.remover([caminho]);
  });

  describe("restrições do próprio bucket", () => {
    const caminho = () => `${crypto.randomUUID()}/contrato-social/doc`;

    it("aceita PDF e DOCX", async () => {
      const gateway = new SupabaseArquivoStorageGateway(await comoAdmin());
      const docx = new File(["x"], "doc.docx", {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });

      expect((await gateway.enviar(`${caminho()}.pdf`, arquivo())).ok).toBe(true);
      expect((await gateway.enviar(`${caminho()}.docx`, docx)).ok).toBe(true);
    });

    it("nega MIME fora de PDF/DOCX, mesmo por upload direto ao Storage", async () => {
      const supabase = await comoAdmin();
      const imagem = new File(["x"], "foto.png", { type: "image/png" });

      const { error } = await supabase.storage
        .from("documentos-clientes")
        .upload(`${caminho()}.png`, imagem);

      expect(error).not.toBeNull();
    });

    it("nega arquivo acima de 10 MB", async () => {
      const supabase = await comoAdmin();
      const grande = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "grande.pdf", {
        type: "application/pdf",
      });

      const { error } = await supabase.storage
        .from("documentos-clientes")
        .upload(`${caminho()}.pdf`, grande);

      expect(error).not.toBeNull();
    });
  });
});
