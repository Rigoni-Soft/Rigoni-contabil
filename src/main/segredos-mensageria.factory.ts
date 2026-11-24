import "server-only";

import { timingSafeEqual } from "node:crypto";

export const SEGREDOS_MENSAGERIA_PLACEHOLDER = {
  assinatura: "segredo-falso",
  tokenVerificacao: "token-falso",
  sessao: "segredo-sessao-falso",
} as const;

type Segredos = Record<keyof typeof SEGREDOS_MENSAGERIA_PLACEHOLDER, string>;

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

export function pedeAdapterFalsoDoE2E(
  esperado: string | undefined,
  enviado: string | null,
): boolean {
  if (!esperado || !enviado) return false;
  const a = Buffer.from(esperado);
  const b = Buffer.from(enviado);
  return a.length === b.length && timingSafeEqual(a, b);
}
