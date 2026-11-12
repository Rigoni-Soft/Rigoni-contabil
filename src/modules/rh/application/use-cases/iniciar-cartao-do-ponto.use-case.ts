import type {
  IniciarCartaoDoPontoInput,
  IniciarCartaoDoPontoPort,
} from "@/modules/rh/application/ports/in/iniciar-cartao-do-ponto.provider";
import type { AuditoriaPort } from "@/modules/rh/application/ports/out/auditoria.provider";
import type { FolhaDePontoRepository } from "@/modules/rh/application/ports/out/folha-de-ponto.repository";
import type { RelogioPort } from "@/modules/rh/application/ports/out/relogio.provider";
import type { SessaoPort } from "@/modules/rh/application/ports/out/sessao.provider";
import { EscreverPonto } from "@/modules/rh/application/use-cases/gerir-quadro-de-funcionarios.use-case";
import { Competencia } from "@/modules/rh/domain/value-objects/competencia.vo";
import type { AppError } from "@/shared/errors/app.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, type Result } from "@/shared/kernel/result";

// O "Salvar" do cartão de um mês, mesmo sem nenhum horário digitado, marca o cartão como iniciado: dali em
// diante os dias úteis sem batida são falta (antes, o cartão é novo e os dias vazios ainda não contam). A
// marca não se desfaz e é idempotente.
export class IniciarCartaoDoPonto extends EscreverPonto implements IniciarCartaoDoPontoPort {
  constructor(
    sessao: SessaoPort,
    repositorio: FolhaDePontoRepository,
    auditoria: AuditoriaPort,
    private readonly relogio: RelogioPort,
  ) {
    super(sessao, repositorio, auditoria, "rh.ponto.iniciar-cartao");
  }

  async execute(input: IniciarCartaoDoPontoInput): Promise<Result<void, AppError>> {
    const competencia = Competencia.criar(input.competencia);
    if (!competencia.ok) return competencia;
    if (competencia.value.ehFutura(this.relogio.agora())) {
      return err(new ValidationError("Não há cartão de um mês que ainda não começou."));
    }
    const autorizado = await this.autorizarPorEmpregado(input.empregadoId);
    if (!autorizado.ok) return autorizado;
    return this.repositorio.iniciarCartao(input.empregadoId, competencia.value.primeiroDia);
  }
}
