// Valores de desenvolvimento do `env.ts` e do `.env.example`. Em produção nenhum deles vale.
export const SEGREDOS_MENSAGERIA_PLACEHOLDER = {
  assinatura: "segredo-falso",
  tokenVerificacao: "token-falso",
  sessao: "segredo-sessao-falso",
} as const;

type Segredos = Record<keyof typeof SEGREDOS_MENSAGERIA_PLACEHOLDER, string>;

// Falha fechada: a rota do webhook é pública e usa service_role, então em produção segredo
// igual ao placeholder (publicado no repositório) permitiria forjar HMAC válido. Roda antes
// de criar o client privilegiado; fora de produção o placeholder segue valendo.
export function exigirSegredosReais(segredos: Segredos, producao: boolean): void {
  if (!producao) return;
  const falsos = (Object.keys(segredos) as (keyof Segredos)[]).filter(
    (nome) => segredos[nome] === SEGREDOS_MENSAGERIA_PLACEHOLDER[nome],
  );
  if (falsos.length > 0) {
    throw new Error(
      `Webhook de mensageria bloqueado em produção: segredo(s) de desenvolvimento em uso (${falsos.join(", ")}). Defina MENSAGERIA_SEGREDO_ASSINATURA, MENSAGERIA_TOKEN_VERIFICACAO e MENSAGERIA_SEGREDO_SESSAO reais.`,
    );
  }
}
