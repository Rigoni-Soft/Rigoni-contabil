import type {
  DefinirConvencaoDoEmpregadoInput,
  DefinirConvencaoDoEmpregadoPort,
  DefinirInterruptoresDoClienteInput,
  DefinirInterruptoresDoClientePort,
} from "@/modules/rh/application/ports/in/gerir-convencao.provider";
import type { AuditoriaPort } from "@/modules/rh/application/ports/out/auditoria.provider";
import type { FolhaDePontoRepository } from "@/modules/rh/application/ports/out/folha-de-ponto.repository";
import type { SessaoPort } from "@/modules/rh/application/ports/out/sessao.provider";
import { EscreverPonto } from "@/modules/rh/application/use-cases/gerir-quadro-de-funcionarios.use-case";
import { validarSindicato } from "@/modules/rh/domain/services/validar-ponto.service";
import type { AppError } from "@/shared/errors/app.error";
import { ok, type Result } from "@/shared/kernel/result";

// Interruptores do Cliente e ponteiro do empregado para a convenção: como o resto da Folha de ponto, só o
// Responsável do RH do Cliente grava (o banco repete a regra e audita o sucesso).
export class DefinirInterruptoresDoCliente
  extends EscreverPonto
  implements DefinirInterruptoresDoClientePort
{
  constructor(sessao: SessaoPort, repositorio: FolhaDePontoRepository, auditoria: AuditoriaPort) {
    super(sessao, repositorio, auditoria, "rh.cliente.interruptores");
  }

  async execute(input: DefinirInterruptoresDoClienteInput): Promise<Result<void, AppError>> {
    const ator = await this.autorizar(input.clienteId);
    if (!ator.ok) return ator;
    return this.repositorio.definirInterruptores(input.clienteId, {
      bancoDeHoras: input.bancoDeHoras,
      trabalhoAosDomingos: input.trabalhoAosDomingos,
    });
  }
}

export class DefinirConvencaoDoEmpregado
  extends EscreverPonto
  implements DefinirConvencaoDoEmpregadoPort
{
  constructor(sessao: SessaoPort, repositorio: FolhaDePontoRepository, auditoria: AuditoriaPort) {
    super(sessao, repositorio, auditoria, "rh.empregado.corrigir");
  }

  async execute(input: DefinirConvencaoDoEmpregadoInput): Promise<Result<void, AppError>> {
    const lido = input.sindicato === null ? ok(null) : validarSindicato(input.sindicato);
    if (!lido.ok) return lido;
    const sindicato = lido.value;
    const autorizado = await this.autorizarPorEmpregado(input.empregadoId);
    if (!autorizado.ok) return autorizado;
    return this.repositorio.definirConvencaoDoEmpregado(input.empregadoId, sindicato);
  }
}
