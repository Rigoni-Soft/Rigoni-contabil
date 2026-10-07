import type {
  GuiaFiscal,
  GuiasFiscaisPort,
  TipoGuia,
} from "@/modules/atendimento/application/ports/out/guias-fiscais.provider";
import type { ObrigacoesFiscaisPort } from "@/modules/clientes/application/ports/out/obrigacoes-fiscais.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, type Result } from "@/shared/kernel/result";

// Liga a porta de guias do atendimento às obrigações fiscais do módulo clientes (#38). Fica no
// `main` porque um módulo não importa o outro (mesmo padrão de `sessaoViaUsuarios`).
export class GuiasFiscaisViaClientes implements GuiasFiscaisPort {
  constructor(
    private readonly cnpjDoCliente: (clienteId: string) => Promise<Result<string, AppError>>,
    private readonly fontes: ObrigacoesFiscaisPort,
  ) {}

  async buscar(clienteId: string, tipo: TipoGuia): Promise<Result<GuiaFiscal, AppError>> {
    const cnpj = await this.cnpjDoCliente(clienteId);
    if (!cnpj.ok) return cnpj;
    const autorizacao = await this.fontes.consultarAutorizacao(cnpj.value);
    if (!autorizacao.ok) return autorizacao;
    if (!autorizacao.value.vigente) {
      return err(new ValidationError("Cliente sem autorização vigente para consulta fiscal."));
    }
    return this.buscarPorTipo(cnpj.value, tipo);
  }

  private async buscarPorTipo(cnpj: string, tipo: TipoGuia): Promise<Result<GuiaFiscal, AppError>> {
    if (tipo === "das") return this.fontes.buscarDas(cnpj);
    if (tipo === "parcelamento") return this.fontes.buscarGuiaParcelamento(cnpj);
    return this.fontes.buscarCnd(cnpj);
  }
}
