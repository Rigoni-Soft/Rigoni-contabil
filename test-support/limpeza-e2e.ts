import { exigirSupabaseLocal } from "./exigir-supabase-local";

// Limpeza anterior à suíte e2e: os Clientes que as execuções passadas cadastraram pela interface.
// - Com `BASE_URL` (deploy já de pé) o banco não é da suíte: não faz nada.
// - Sem ela, recusa qualquer Supabase que não seja local ANTES de qualquer I/O (a app local pode
//   estar apontada para um banco remoto, e a chave de serviço do ambiente não prova o contrário).
// - Só apaga os CNPJs que as suítes registraram, nunca um filtro por nome: um Cliente alheio com
//   "E2E" no nome fica como está.
// - `zerarAvisos` (opcional) roda sob o mesmo guarda local: o selo do sino para em "99+" e as suítes
//   que contam não vistos precisam partir de um backlog pequeno.
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
