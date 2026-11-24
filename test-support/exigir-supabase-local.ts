const LOOPBACK = /^[a-z]+:\/\/([^@/]*@)?(127\.0\.0\.1|localhost)([:/]|$)/;

export function exigirSupabaseLocal(...destinos: readonly string[]): void {
  for (const destino of destinos) {
    if (!LOOPBACK.test(destino)) {
      throw new Error("Suíte destrutiva só roda contra o Supabase/PostgreSQL local (loopback).");
    }
  }
}

export function exigirDestinoDoE2E(
  supabaseUrl: string,
  opcoes: { baseUrl?: string; refHomolog?: string },
): void {
  const { baseUrl, refHomolog } = opcoes;
  if (baseUrl && refHomolog && /^[a-z0-9]{20}$/.test(refHomolog)) {
    if (supabaseUrl === `https://${refHomolog}.supabase.co`) return;
  }
  exigirSupabaseLocal(supabaseUrl);
}
