import { timingSafeEqual } from "node:crypto";

import type { AutenticacaoJobPort } from "@/modules/atendimento/application/ports/out/autenticacao-job.provider";

// Cabeçalho `Authorization: Bearer <segredo>`, como o Vercel Cron manda `CRON_SECRET`. Sem segredo
// configurado, ninguém é autorizado.
export class BearerAutenticacaoJobGateway implements AutenticacaoJobPort {
  constructor(private readonly segredo: string | undefined) {}

  autorizado(authorization: string | null): boolean {
    if (this.segredo === undefined || authorization === null) return false;
    const recebido = Buffer.from(authorization);
    const esperado = Buffer.from(`Bearer ${this.segredo}`);
    return recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
  }
}
