/**
 * Integração infra ↔ Supabase Auth (testes.md, seção 3): requer `npx supabase start`
 * rodando localmente com o seed aplicado.
 */
import { createClient } from "@supabase/supabase-js";

import { SupabaseSessaoGateway } from "./supabase-sessao.gateway";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

// Conta descartável (não os usuários do seed): #31 muda a senha de verdade, e um
// teste que mutasse um usuário do seed deixaria a suíte dependente de ordem.
async function criarContaAuthDeTeste(): Promise<{ email: string; senha: string }> {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const email = `teste-troca-senha-${crypto.randomUUID()}@rigonicontabil.local`;
  const senha = "senha-provisoria-123";
  const { error } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
  });
  if (error) throw new Error(`Falha ao criar conta de teste: ${error.message}`);
  return { email, senha };
}

describe("SupabaseSessaoGateway (integração)", () => {
  it("autentica com credenciais válidas e expõe o id do usuário logado", async () => {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const gateway = new SupabaseSessaoGateway(supabase);

    const autenticado = await gateway.autenticar("admin@rigonicontabil.local", "admin123");
    expect(autenticado.ok).toBe(true);

    const id = await gateway.usuarioAtualId();
    expect(id).toBe("11111111-1111-1111-1111-111111111111");
  });

  it("rejeita credenciais inválidas com ForbiddenError", async () => {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const gateway = new SupabaseSessaoGateway(supabase);

    const autenticado = await gateway.autenticar("admin@rigonicontabil.local", "senha-errada");

    expect(autenticado.ok).toBe(false);
  });

  it("encerra a sessão e usuarioAtualId volta a ser null", async () => {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const gateway = new SupabaseSessaoGateway(supabase);
    await gateway.autenticar("admin@rigonicontabil.local", "admin123");

    await gateway.encerrar();

    expect(await gateway.usuarioAtualId()).toBeNull();
  });

  it("troca a senha do usuário autenticado (#31) e a nova senha passa a autenticar", async () => {
    const { email, senha } = await criarContaAuthDeTeste();
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const gateway = new SupabaseSessaoGateway(supabase);
    await gateway.autenticar(email, senha);

    const resultado = await gateway.trocarSenha("nova-senha-definitiva-123");

    expect(resultado.ok).toBe(true);
    await gateway.encerrar();
    const reautenticado = await gateway.autenticar(email, "nova-senha-definitiva-123");
    expect(reautenticado.ok).toBe(true);
  });

  it("reenvio com a mesma senha (devolutiva PR #62, ponto 1) vira erro distinguível, não sucesso cego", async () => {
    const { email, senha } = await criarContaAuthDeTeste();
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const gateway = new SupabaseSessaoGateway(supabase);
    await gateway.autenticar(email, senha);

    // Simula o cenário real: updateUser() já teve sucesso numa primeira
    // submissão (finalização/auditoria falhou depois, por algum motivo), e o
    // usuário reenvia o mesmo formulário — mesma senha nova de antes. O
    // gateway não decide mais se isso é reenvio legítimo ou a própria senha
    // provisória sendo reenviada (ponto 1) — quem decide é TrocarSenha.execute(),
    // que conhece precisaTrocarSenha() do perfil. Aqui só garantimos que o
    // gateway devolve um erro reconhecível, não ok() cego.
    const primeira = await gateway.trocarSenha("nova-senha-definitiva-123");
    expect(primeira.ok).toBe(true);

    const reenvio = await gateway.trocarSenha("nova-senha-definitiva-123");

    expect(reenvio.ok).toBe(false);
    if (!reenvio.ok) expect(reenvio.error.code).toBe("SENHA_JA_DEFINIDA");
  });
});
