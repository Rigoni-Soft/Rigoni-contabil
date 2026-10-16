import { z } from "zod";

import type {
  CertidaoCndPort,
  CndDto,
} from "@/modules/clientes/application/ports/out/certidao-cnd.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { err, ok, type Result } from "@/shared/kernel/result";

const TIMEOUT_MS = 10_000;

const cndSchema = z.object({
  nomeArquivo: z.string(),
  pdfBase64: z.string(),
  validade: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// Fala `GET /clientes/{cnpj}/cnd` do contrato neutro (o mock de `mock-api/` em dev).
export class CertidaoCndHttpGateway implements CertidaoCndPort {
  constructor(
    private readonly baseUrl: string,
    private readonly http: typeof fetch = fetch,
  ) {}

  async buscarCnd(cnpj: string): Promise<Result<CndDto, AppError>> {
    try {
      const resposta = await this.http(`${this.baseUrl}/clientes/${cnpj}/cnd`, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!resposta.ok) {
        return err(new ServicoExternoError(`Serviço fiscal respondeu ${resposta.status}.`));
      }
      const dados = cndSchema.safeParse(await resposta.json());
      if (!dados.success) {
        return err(new ServicoExternoError("Serviço fiscal respondeu fora do contrato."));
      }
      return ok(dados.data);
    } catch {
      return err(new ServicoExternoError("Serviço fiscal indisponível."));
    }
  }
}
