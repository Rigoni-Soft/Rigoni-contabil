import type {
  BuscarGuiaOutput,
  BuscarGuiaPort,
} from "@/modules/clientes/application/ports/in/buscar-guia.provider";
import type { SerproPort } from "@/modules/clientes/application/ports/out/serpro.provider";
import type { SessaoPort } from "@/modules/clientes/application/ports/out/sessao.provider";
import { Cnpj } from "@/modules/clientes/domain/value-objects/cnpj.vo";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";

// Sem procuração e-CAC vigente a chamada falharia só pra esse CNPJ: falha
// esperada por cliente, devolvida de forma acionável (serpro-api.md §4).
export class BuscarGuia implements BuscarGuiaPort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly serpro: SerproPort,
  ) {}

  async execute(entrada: string): Promise<Result<BuscarGuiaOutput, AppError>> {
    if (!(await this.sessao.usuarioAtual())) {
      return err(new ForbiddenError("Sessão inválida. Entre novamente."));
    }
    const cnpj = Cnpj.criar(entrada);
    if (!cnpj.ok) return cnpj;
    const { digitos } = cnpj.value;

    const procuracao = await this.serpro.consultarProcuracao(digitos);
    if (!procuracao.ok) return procuracao;
    if (!procuracao.value.vigente) {
      return err(
        new ValidationError(
          `Cliente ${entrada} sem procuração eletrônica vigente para o escritório.`,
        ),
      );
    }

    const [das, parcelamento, cnd] = await Promise.all([
      this.serpro.buscarDas(digitos),
      this.serpro.buscarGuiaParcelamento(digitos),
      this.serpro.buscarCnd(digitos),
    ]);
    if (!das.ok) return das;
    if (!parcelamento.ok) return parcelamento;
    if (!cnd.ok) return cnd;
    return ok({ das: das.value, parcelamento: parcelamento.value, cnd: cnd.value });
  }
}
