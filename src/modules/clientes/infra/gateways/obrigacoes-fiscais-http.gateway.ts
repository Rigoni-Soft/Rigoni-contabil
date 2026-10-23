import { z } from "zod";

import type {
  AutorizacaoDto,
  GuiaDasDto,
  GuiaParcelamentoDto,
  ObrigacoesFiscaisPort,
  PedidoGuiaParcelamento,
} from "@/modules/clientes/application/ports/out/obrigacoes-fiscais.provider";
import type { AppError } from "@/shared/errors/app.error";
import { GuiaParcelamentoIndisponivelError } from "@/shared/errors/guia-parcelamento-indisponivel.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { err, ok, type Result } from "@/shared/kernel/result";

const TIMEOUT_MS = 10_000;

const documento = { nomeArquivo: z.string(), pdfBase64: z.string() };
const dataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const dasSchema = z.object({
  ...documento,
  competencia: z.string().regex(/^\d{4}-\d{2}$/),
  valorCentavos: z.number().int(),
  vencimento: dataIso,
});
const parcelamentoSchema = z.object({
  ...documento,
  parcela: z.string().regex(/^\d{6}$/),
  valorCentavos: z.number().int().optional(),
  vencimento: dataIso.optional(),
});
// Recusa tipada da guia por código: 422 com o motivo (docs/contratos/obrigacoes-fiscais.md).
const recusaSchema = z.object({
  motivo: z.enum(["codigo_desconhecido", "quitado", "fora_do_periodo", "ambiguo"]),
});
const autorizacaoSchema = z.discriminatedUnion("vigente", [
  z.object({ vigente: z.literal(true), dataExpiracao: dataIso }),
  z.object({ vigente: z.literal(false) }),
]);

// Fala o contrato neutro de docs/contratos/obrigacoes-fiscais.md com qualquer
// servidor que o implemente: o mock de `mock-api/` em dev, um tradutor pro
// provedor real depois. Falha de rede/HTTP/formato vira ServicoExternoError.
export class ObrigacoesFiscaisHttpGateway implements ObrigacoesFiscaisPort {
  constructor(
    private readonly baseUrl: string,
    private readonly http: typeof fetch = fetch,
  ) {}

  buscarDas(cnpj: string): Promise<Result<GuiaDasDto, AppError>> {
    return this.obter(cnpj, "das", dasSchema);
  }

  // `regime` e `emAbertoDaReceita` são do adapter do provedor: o contrato só conhece o código.
  buscarGuiaParcelamento(
    cnpj: string,
    { codigo }: PedidoGuiaParcelamento,
  ): Promise<Result<GuiaParcelamentoDto, AppError>> {
    return this.obter(cnpj, `parcelamentos/${encodeURIComponent(codigo)}`, parcelamentoSchema);
  }

  consultarAutorizacao(cnpj: string): Promise<Result<AutorizacaoDto, AppError>> {
    return this.obter(cnpj, "autorizacao", autorizacaoSchema);
  }

  private async obter<S extends z.ZodType>(
    cnpj: string,
    recurso: string,
    schema: S,
  ): Promise<Result<z.infer<S>, AppError>> {
    try {
      const resposta = await this.http(`${this.baseUrl}/clientes/${cnpj}/${recurso}`, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!resposta.ok) {
        const recusa = recusaSchema.safeParse(
          resposta.status === 422 ? await resposta.json().catch(() => null) : null,
        );
        if (recusa.success) {
          return err(new GuiaParcelamentoIndisponivelError(recusa.data.motivo));
        }
        return err(new ServicoExternoError(`Serviço fiscal respondeu ${resposta.status}.`));
      }
      const dados = schema.safeParse(await resposta.json());
      if (!dados.success) {
        return err(new ServicoExternoError("Serviço fiscal respondeu fora do contrato."));
      }
      return ok(dados.data);
    } catch {
      return err(new ServicoExternoError("Serviço fiscal indisponível."));
    }
  }
}
