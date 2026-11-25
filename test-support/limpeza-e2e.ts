import { exigirSupabaseLocal } from "./exigir-supabase-local";

export async function limparClientesDoE2E(opcoes: {
  baseUrl: string | undefined;
  supabaseUrl: string;
  cnpjs: readonly string[];
  remover: (cnpjs: readonly string[]) => Promise<void>;
  zerarAvisos?: () => Promise<void>;
}): Promise<void> {
  if (opcoes.baseUrl) return;
  exigirSupabaseLocal(opcoes.supabaseUrl);
  await opcoes.zerarAvisos?.();
  if (opcoes.cnpjs.length === 0) return;
  await opcoes.remover(opcoes.cnpjs);
}
