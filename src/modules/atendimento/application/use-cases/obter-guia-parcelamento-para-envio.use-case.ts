import type {
  GuiaParcelamentoParaEnvio,
  ObterGuiaParcelamentoParaEnvioPort,
} from "@/modules/atendimento/application/ports/in/obter-guia-parcelamento-para-envio.provider";
import type { GuiaPublicadaPort } from "@/modules/atendimento/application/ports/out/guia-publicada.provider";
import type { GuiasFiscaisPort } from "@/modules/atendimento/application/ports/out/guias-fiscais.provider";
import { obterGuiaPublicada } from "@/modules/atendimento/application/use-cases/obter-guia-publicada";
import type { AppError } from "@/shared/errors/app.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { ESPERA_MS } from "@/shared/kernel/com-tentativas";
import { formatarParcela } from "@/shared/kernel/data-iso";
import { err, ok, type Result } from "@/shared/kernel/result";

// Busca a guia de parcelamento no provedor fiscal e a publica.
export class ObterGuiaParcelamentoParaEnvio implements ObterGuiaParcelamentoParaEnvioPort {
  constructor(
    private readonly guias: GuiasFiscaisPort,
    private readonly publicadas: GuiaPublicadaPort,
    private readonly esperaEntreTentativasMs = ESPERA_MS,
  ) {}

  execute(clienteId: string): Promise<Result<GuiaParcelamentoParaEnvio, AppError>> {
    return obterGuiaPublicada(
      this.guias,
      this.publicadas,
      this.esperaEntreTentativasMs,
      clienteId,
      "parcelamento",
      ({ parcela }) =>
        parcela
          ? ok({ parcela: formatarParcela(parcela) })
          : err(new ServicoExternoError("Guia de parcelamento sem parcela.")),
    );
  }
}
