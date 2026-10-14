import type {
  GuiaDasParaEnvio,
  ObterGuiaDasParaEnvioPort,
} from "@/modules/atendimento/application/ports/in/obter-guia-das-para-envio.provider";
import type { GuiaPublicadaPort } from "@/modules/atendimento/application/ports/out/guia-publicada.provider";
import type { GuiasFiscaisPort } from "@/modules/atendimento/application/ports/out/guias-fiscais.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { comTentativas, ESPERA_MS, TENTATIVAS } from "@/shared/kernel/com-tentativas";
import { formatarCompetencia, formatarDataIso } from "@/shared/kernel/data-iso";
import { err, ok, type Result } from "@/shared/kernel/result";

// Busca a guia do DAS no provedor fiscal e a publica. Falha do serviço externo repete antes de
// devolver o erro.
export class ObterGuiaDasParaEnvio implements ObterGuiaDasParaEnvioPort {
  constructor(
    private readonly guias: GuiasFiscaisPort,
    private readonly publicadas: GuiaPublicadaPort,
    private readonly esperaEntreTentativasMs = ESPERA_MS,
  ) {}

  execute(clienteId: string): Promise<Result<GuiaDasParaEnvio, AppError>> {
    return comTentativas(() => this.obter(clienteId), TENTATIVAS, this.esperaEntreTentativasMs);
  }

  private async obter(clienteId: string): Promise<Result<GuiaDasParaEnvio, AppError>> {
    const buscada = await this.guias.buscar(clienteId, "das");
    if (!buscada.ok) return buscada;
    const { competencia, vencimento, nomeArquivo } = buscada.value;
    if (!competencia || !vencimento) {
      return err(new ServicoExternoError("Guia do DAS sem competência ou vencimento."));
    }
    const url = await this.publicadas.publicar(clienteId, buscada.value);
    if (!url.ok) return url;
    return ok({
      competencia: formatarCompetencia(competencia),
      vencimento: formatarDataIso(vencimento),
      guia: { url: url.value, nomeArquivo },
    });
  }
}
