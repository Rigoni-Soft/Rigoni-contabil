import type {
  GuiaParcelamentoParaEnvio,
  ObterGuiaParcelamentoParaEnvioPort,
} from "@/modules/atendimento/application/ports/in/obter-guia-parcelamento-para-envio.provider";
import type { GuiaPublicadaPort } from "@/modules/atendimento/application/ports/out/guia-publicada.provider";
import type { GuiasFiscaisPort } from "@/modules/atendimento/application/ports/out/guias-fiscais.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { comTentativas, ESPERA_MS, TENTATIVAS } from "@/shared/kernel/com-tentativas";
import { formatarParcela } from "@/shared/kernel/data-iso";
import { err, ok, type Result } from "@/shared/kernel/result";

// Busca a guia de parcelamento no provedor fiscal e a publica. Falha do serviço externo repete
// antes de devolver o erro.
export class ObterGuiaParcelamentoParaEnvio implements ObterGuiaParcelamentoParaEnvioPort {
  constructor(
    private readonly guias: GuiasFiscaisPort,
    private readonly publicadas: GuiaPublicadaPort,
    private readonly esperaEntreTentativasMs = ESPERA_MS,
  ) {}

  execute(clienteId: string): Promise<Result<GuiaParcelamentoParaEnvio, AppError>> {
    return comTentativas(() => this.obter(clienteId), TENTATIVAS, this.esperaEntreTentativasMs);
  }

  private async obter(clienteId: string): Promise<Result<GuiaParcelamentoParaEnvio, AppError>> {
    const buscada = await this.guias.buscar(clienteId, "parcelamento");
    if (!buscada.ok) return buscada;
    const { parcela, nomeArquivo } = buscada.value;
    if (!parcela) return err(new ServicoExternoError("Guia de parcelamento sem parcela."));
    const url = await this.publicadas.publicar(clienteId, buscada.value);
    if (!url.ok) return url;
    return ok({ parcela: formatarParcela(parcela), guia: { url: url.value, nomeArquivo } });
  }
}
