import type {
  SalvarDiaDoPontoInput,
  SalvarDiaDoPontoPort,
} from "@/modules/rh/application/ports/in/salvar-dia-do-ponto.provider";
import type { AuditoriaPort } from "@/modules/rh/application/ports/out/auditoria.provider";
import type { FolhaDePontoRepository } from "@/modules/rh/application/ports/out/folha-de-ponto.repository";
import type { RelogioPort } from "@/modules/rh/application/ports/out/relogio.provider";
import type { SessaoPort } from "@/modules/rh/application/ports/out/sessao.provider";
import { EscreverPonto } from "@/modules/rh/application/use-cases/gerir-quadro-de-funcionarios.use-case";
import { validarPares } from "@/modules/rh/domain/services/validar-ponto.service";
import { Competencia } from "@/modules/rh/domain/value-objects/competencia.vo";
import type { AppError } from "@/shared/errors/app.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { dataIsoValida } from "@/shared/kernel/data-iso";
import { err, type Result } from "@/shared/kernel/result";

// Um dia do Cartão de ponto: até 4 pares de batida, a coluna Extra e a sinalização de Abono.
export class SalvarDiaDoPonto extends EscreverPonto implements SalvarDiaDoPontoPort {
  constructor(
    sessao: SessaoPort,
    repositorio: FolhaDePontoRepository,
    auditoria: AuditoriaPort,
    private readonly relogio: RelogioPort,
  ) {
    super(sessao, repositorio, auditoria, "rh.ponto.salvar");
  }

  async execute(input: SalvarDiaDoPontoInput): Promise<Result<void, AppError>> {
    if (!dataIsoValida(input.data)) {
      return err(new ValidationError("Data inválida.", { data: ["Data inválida"] }));
    }
    // Como no IniciarCartaoDoPonto: não há cartão de mês que ainda não começou (o dia futuro do mês corrente vale).
    const competencia = Competencia.criar(input.data.slice(0, 7));
    if (!competencia.ok) return competencia;
    if (competencia.value.ehFutura(this.relogio.agora())) {
      return err(new ValidationError("Não há cartão de um mês que ainda não começou."));
    }
    const batidas = validarPares(input.batidas, 4);
    if (!batidas.ok) return batidas;
    const extra = validarPares(input.extra ? [input.extra] : [], 1);
    if (!extra.ok) return extra;

    const autorizado = await this.autorizarPorEmpregado(input.empregadoId);
    if (!autorizado.ok) return autorizado;
    return this.repositorio.salvarDia(input.empregadoId, {
      data: input.data,
      batidas: batidas.value,
      extra: extra.value[0] ?? null,
      abono: input.abono,
    });
  }
}
