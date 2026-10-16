/**
 * Prova de segurança de dados da limpeza das suítes de integração: ela
 * apaga só os CNPJs que recebe, nunca um Cliente que não é da suíte. Requer Supabase local.
 */
import { createClient } from "@supabase/supabase-js";

import { removerClientesDeTeste } from "./clientes-de-teste";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const DA_SUITE = "71000000000101";
const ALHEIO = "71000000000202";
const ids = { daSuite: crypto.randomUUID(), alheio: crypto.randomUUID() };

async function existe(cnpj: string): Promise<boolean> {
  const { data } = await admin.from("clientes").select("id").eq("cnpj", cnpj);
  return (data?.length ?? 0) > 0;
}

afterAll(async () => {
  await admin.from("clientes").delete().in("id", [ids.daSuite, ids.alheio]);
});

describe("removerClientesDeTeste", () => {
  it("apaga os CNPJs da suíte e mantém qualquer outro Cliente, a cada chamada", async () => {
    const criados = await admin.from("clientes").insert([
      { id: ids.daSuite, empresa: "Da Suite Ltda", cnpj: DA_SUITE, regime: "lucro_presumido" },
      { id: ids.alheio, empresa: "Alheio E2E Ltda", cnpj: ALHEIO, regime: "lucro_presumido" },
    ]);
    expect(criados.error).toBeNull();

    await removerClientesDeTeste([DA_SUITE]);
    expect(await existe(DA_SUITE)).toBe(false);
    expect(await existe(ALHEIO)).toBe(true);

    // De novo (execução seguinte): continua sem tocar no alheio e sem falhar com a suíte já limpa.
    await removerClientesDeTeste([DA_SUITE]);
    expect(await existe(ALHEIO)).toBe(true);
  });
});
