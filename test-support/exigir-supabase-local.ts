const LOOPBACK = /^[a-z]+:\/\/([^@/]*@)?(127\.0\.0\.1|localhost)([:/]|$)/;

export function exigirSupabaseLocal(...destinos: readonly string[]): void {
  for (const destino of destinos) {
    if (!LOOPBACK.test(destino)) {
      throw new Error("Suíte destrutiva só roda contra o Supabase/PostgreSQL local (loopback).");
    }
  }
}

const REF_DE_PROJETO_SUPABASE = /^[a-z0-9]{20}$/;

export function exigirDestinoDoE2E(
  supabaseUrl: string,
  opcoes: { baseUrl?: string; refHomolog?: string },
): void {
  const { baseUrl, refHomolog } = opcoes;
  if (baseUrl && refHomolog && REF_DE_PROJETO_SUPABASE.test(refHomolog)) {
    if (supabaseUrl === `https://${refHomolog}.supabase.co`) return;
  }
  exigirSupabaseLocal(supabaseUrl);
}
