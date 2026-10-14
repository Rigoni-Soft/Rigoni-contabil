const LOOPBACK = /^[a-z]+:\/\/([^@/]*@)?(127\.0\.0\.1|localhost)([:/]|$)/;

// Suítes de integração que apagam dados chamam isto antes de qualquer setup: com variáveis de
// ambiente apontando para uma base compartilhada/remota, falham alto em vez de limpar o que é de
// outros.
export function exigirSupabaseLocal(...destinos: readonly string[]): void {
  for (const destino of destinos) {
    if (!LOOPBACK.test(destino)) {
      throw new Error("Suíte destrutiva só roda contra o Supabase/PostgreSQL local (loopback).");
    }
  }
}
