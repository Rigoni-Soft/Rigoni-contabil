import "server-only";

import { timingSafeEqual } from "node:crypto";

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

export const CABECALHO_ADAPTER_FALSO_E2E = "x-e2e-adapter-falso";

// Os e2e rodam contra um deploy com mensageria real e não podem falar com a Meta (telefones
// fictícios, ids de mídia inventados). Com E2E_ADAPTER_SECRET definido, uma requisição que traga
// esse valor no cabeçalho usa o adapter FALSO, que nunca envia nada; sem o segredo configurado,
// ou com valor errado, o modo do ambiente vale. Só ESCOLHE o adapter falso: não abre nenhum acesso.
export function pedeAdapterFalsoDoE2E(
  esperado: string | undefined,
  enviado: string | null,
): boolean {
  if (!esperado || !enviado) return false;
  const a = Buffer.from(esperado);
  const b = Buffer.from(enviado);
  return a.length === b.length && timingSafeEqual(a, b);
}
