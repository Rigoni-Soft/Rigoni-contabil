import type {
  BuscarGuiaOutput,
  BuscarGuiaPort,
} from "@/modules/clientes/application/ports/in/buscar-guia.provider";
import type { ObrigacoesFiscaisPort } from "@/modules/clientes/application/ports/out/obrigacoes-fiscais.provider";
import type { SessaoPort } from "@/modules/clientes/application/ports/out/sessao.provider";
import { Cnpj } from "@/modules/clientes/domain/value-objects/cnpj.vo";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";

// TODO(#66): só confere sessão e formato do CNPJ; falta verificar se o CNPJ é de um Cliente visível
// ao ator (Responsável/Setor, ou Contato reconhecido pela URA) antes de consultar a fonte fiscal.
// Sem endpoint público e com provedor falso não há exposição hoje; é gate para o Serpro real.
// Sem autorização vigente a consulta falharia só pra esse CNPJ: falha
// esperada por cliente, devolvida de forma acionável (contrato em docs/contratos).
export class BuscarGuia implements BuscarGuiaPort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly fontes: ObrigacoesFiscaisPort,
  ) {}

  async execute(entrada: string): Promise<Result<BuscarGuiaOutput, AppError>> {
    if (!(await this.sessao.usuarioAtual())) {
      return err(new ForbiddenError("Sessão inválida. Entre novamente."));
    }
    const cnpj = Cnpj.criar(entrada);
    if (!cnpj.ok) return cnpj;
    try {
      return await this.buscar(entrada, cnpj.value.valor);
    } catch {
      // Adapter real (timeout/rede) pode lançar: nunca derruba o sistema.
      return err(new ServicoExternoError("Falha ao consultar as obrigações fiscais."));
    }
  }

  private async buscar(entrada: string, cnpj: string): Promise<Result<BuscarGuiaOutput, AppError>> {
    const autorizacao = await this.fontes.consultarAutorizacao(cnpj);
    if (!autorizacao.ok) return autorizacao;
    if (!autorizacao.value.vigente) {
      return err(
        new ValidationError(
          `Cliente ${entrada} sem autorização vigente para consulta das obrigações fiscais.`,
        ),
      );
    }

    const [das, parcelamento, cnd] = await Promise.all([
      this.fontes.buscarDas(cnpj),
      this.fontes.buscarGuiaParcelamento(cnpj),
      this.fontes.buscarCnd(cnpj),
    ]);
    if (!das.ok) return das;
    if (!parcelamento.ok) return parcelamento;
    if (!cnd.ok) return cnd;
    return ok({ das: das.value, parcelamento: parcelamento.value, cnd: cnd.value });
  }
}
