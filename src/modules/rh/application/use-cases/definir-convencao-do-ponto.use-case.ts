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
import type { AppError } from "@/shared/errors/app.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, type Result } from "@/shared/kernel/result";

const MAXIMO_SINDICATO = 120;

// Interruptores do Cliente e ponteiro do empregado para a convenção: como o resto da Folha de ponto, só o
// Responsável do RH do Cliente grava (o banco repete a regra e audita o sucesso).
export class DefinirInterruptoresDoCliente
  extends EscreverPonto
  implements DefinirInterruptoresDoClientePort
{
  constructor(sessao: SessaoPort, repo: FolhaDePontoRepository, auditoria: AuditoriaPort) {
    super(sessao, repo, auditoria, "rh.cliente.interruptores");
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
  constructor(sessao: SessaoPort, repo: FolhaDePontoRepository, auditoria: AuditoriaPort) {
    super(sessao, repo, auditoria, "rh.empregado.corrigir");
  }

  async execute(input: DefinirConvencaoDoEmpregadoInput): Promise<Result<void, AppError>> {
    const sindicato = input.sindicato === null ? null : input.sindicato.trim();
    if (sindicato !== null && (sindicato === "" || sindicato.length > MAXIMO_SINDICATO)) {
      return err(new ValidationError("Sindicato inválido.", { sindicato: ["Sindicato inválido"] }));
    }
    const autorizado = await this.autorizarPorEmpregado(input.empregadoId);
    if (!autorizado.ok) return autorizado;
    return this.repositorio.definirConvencaoDoEmpregado(input.empregadoId, sindicato);
  }
}
