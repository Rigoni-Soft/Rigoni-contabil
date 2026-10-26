import { obterGuiaPublicada } from "@/modules/atendimento/application/jobs/obter-guia-publicada";
import type {
  GuiaDasParaEnvio,
  ObterGuiaDasParaEnvioPort,
} from "@/modules/atendimento/application/ports/in/obter-guia-das-para-envio.provider";
import type { GuiaPublicadaPort } from "@/modules/atendimento/application/ports/out/guia-publicada.provider";
import type { GuiasFiscaisPort } from "@/modules/atendimento/application/ports/out/guias-fiscais.provider";
import { chaveDoDas } from "@/modules/atendimento/domain/services/guia-guardada.service";
import type { AppError } from "@/shared/errors/app.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { ESPERA_MS } from "@/shared/kernel/com-tentativas";
import { formatarCompetencia, formatarDataIso } from "@/shared/kernel/data-iso";
import { err, ok, type Result } from "@/shared/kernel/result";

// Busca a guia do DAS no provedor fiscal e a publica.
export class ObterGuiaDasParaEnvio implements ObterGuiaDasParaEnvioPort {
  constructor(
    private readonly guias: GuiasFiscaisPort,
    private readonly publicadas: GuiaPublicadaPort,
    private readonly esperaEntreTentativasMs = ESPERA_MS,
  ) {}

  execute(clienteId: string, mes: string): Promise<Result<GuiaDasParaEnvio, AppError>> {
    return obterGuiaPublicada({
      guias: this.guias,
      publicadas: this.publicadas,
      esperaEntreTentativasMs: this.esperaEntreTentativasMs,
      clienteId,
      tipo: "das",
      extrair: ({ competencia, vencimento }) =>
        competencia && vencimento
          ? ok({
              competencia: formatarCompetencia(competencia),
              vencimento: formatarDataIso(vencimento),
            })
          : err(new ServicoExternoError("Guia do DAS sem competência ou vencimento.")),
      chave: chaveDoDas(mes),
    });
  }
}
