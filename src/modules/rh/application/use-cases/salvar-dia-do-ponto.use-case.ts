import type {
  SalvarDiaDoPontoInput,
  SalvarDiaDoPontoPort,
} from "@/modules/rh/application/ports/in/salvar-dia-do-ponto.provider";
import type { AuditoriaPort } from "@/modules/rh/application/ports/out/auditoria.provider";
import type { FolhaDePontoRepository } from "@/modules/rh/application/ports/out/folha-de-ponto.repository";
import type { SessaoPort } from "@/modules/rh/application/ports/out/sessao.provider";
import { EscreverPonto } from "@/modules/rh/application/use-cases/gerir-quadro-de-funcionarios.use-case";
import { validarPares } from "@/modules/rh/domain/services/validar-ponto.service";
import type { AppError } from "@/shared/errors/app.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, type Result } from "@/shared/kernel/result";

const DATA = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

// Um dia do Cartão de ponto: até 4 pares de batida, a coluna Extra e a sinalização de Abono.
export class SalvarDiaDoPonto extends EscreverPonto implements SalvarDiaDoPontoPort {
  constructor(sessao: SessaoPort, repo: FolhaDePontoRepository, auditoria: AuditoriaPort) {
    super(sessao, repo, auditoria, "rh.ponto.salvar");
  }

  async execute(input: SalvarDiaDoPontoInput): Promise<Result<void, AppError>> {
    if (!DATA.test(input.data) || Number.isNaN(Date.parse(input.data))) {
      return err(new ValidationError("Data inválida.", { data: ["Data inválida"] }));
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
