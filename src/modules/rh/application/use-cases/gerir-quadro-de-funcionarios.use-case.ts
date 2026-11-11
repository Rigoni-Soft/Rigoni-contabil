import type {
  CadastrarEmpregadoInput,
  CadastrarEmpregadoPort,
  CorrigirEmpregadoInput,
  CorrigirEmpregadoPort,
  DefinirEmpregadoAtivoInput,
  DefinirEmpregadoAtivoPort,
  DefinirPadraoComissionadosInput,
  DefinirPadraoComissionadosPort,
  DefinirSemMovimentoInput,
  DefinirSemMovimentoPort,
} from "@/modules/rh/application/ports/in/gerir-quadro-de-funcionarios.provider";
import type { AuditoriaPort } from "@/modules/rh/application/ports/out/auditoria.provider";
import type { FolhaDePontoRepository } from "@/modules/rh/application/ports/out/folha-de-ponto.repository";
import type { RelogioPort } from "@/modules/rh/application/ports/out/relogio.provider";
import type { AtorSessaoDto, SessaoPort } from "@/modules/rh/application/ports/out/sessao.provider";
import { validarJornada, validarNome } from "@/modules/rh/domain/services/validar-ponto.service";
import { Competencia } from "@/modules/rh/domain/value-objects/competencia.vo";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { NotFoundError } from "@/shared/errors/not-found.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { podeMarcarAcompanhamentoRh } from "@/shared/kernel/papeis";
import { err, ok, type Result } from "@/shared/kernel/result";

// Só o Funcionário do RH que é Responsável do Cliente grava na Folha de ponto (quadro e cartão); o Líder
// e o Admin leem. O banco repete a regra (RLS) e audita o sucesso na mesma transação; aqui, a primeira
// barreira e a auditoria da tentativa recusada.
export abstract class EscreverPonto {
  constructor(
    protected readonly sessao: SessaoPort,
    protected readonly repositorio: FolhaDePontoRepository,
    private readonly auditoria: AuditoriaPort,
    private readonly acao: string,
  ) {}

  protected async autorizar(clienteId: string): Promise<Result<AtorSessaoDto, AppError>> {
    const ator = await this.sessao.usuarioAtual();
    if (!ator) return err(new ForbiddenError("Sessão inválida. Entre novamente."));

    const cliente = await this.repositorio.buscarCliente(clienteId);
    if (!cliente.ok) return cliente;
    if (
      !podeMarcarAcompanhamentoRh(ator.papel, ator.setor) ||
      cliente.value?.responsavelId !== ator.id
    ) {
      await this.auditoria.registrar({
        ator: ator.id,
        setor: ator.setor,
        acao: this.acao,
        alvo: cliente.value?.cnpj ?? clienteId,
        resultado: "falha",
      });
      return err(new ForbiddenError("Só o Responsável do RH do cliente altera a Folha de ponto."));
    }
    return ok(ator);
  }

  // Empregado fora da vista do ator = inexistente.
  protected async autorizarPorEmpregado(empregadoId: string): Promise<Result<void, AppError>> {
    const cliente = await this.repositorio.buscarClienteDoEmpregado(empregadoId);
    if (!cliente.ok) return cliente;
    if (!cliente.value) return err(new NotFoundError("Empregado não encontrado."));
    const ator = await this.autorizar(cliente.value);
    return ator.ok ? ok(undefined) : ator;
  }
}

export class CadastrarEmpregado extends EscreverPonto implements CadastrarEmpregadoPort {
  constructor(sessao: SessaoPort, repo: FolhaDePontoRepository, auditoria: AuditoriaPort) {
    super(sessao, repo, auditoria, "rh.empregado.cadastrar");
  }

  async execute(input: CadastrarEmpregadoInput): Promise<Result<void, AppError>> {
    const nome = validarNome(input.nome);
    if (!nome.ok) return nome;
    const jornada = validarJornada(input.jornada);
    if (!jornada.ok) return jornada;

    const ator = await this.autorizar(input.clienteId);
    if (!ator.ok) return ator;

    // A marca nasce do padrão do Cliente; o Funcionário a muda por empregado depois.
    let comissionado = input.comissionado;
    if (comissionado === undefined) {
      const padrao = await this.repositorio.buscarPadraoComissionados(input.clienteId);
      if (!padrao.ok) return padrao;
      comissionado = padrao.value;
    }
    return this.repositorio.cadastrarEmpregado(input.clienteId, {
      nome: nome.value,
      jornada: [...jornada.value],
      comissionado,
    });
  }
}

export class CorrigirEmpregado extends EscreverPonto implements CorrigirEmpregadoPort {
  constructor(sessao: SessaoPort, repo: FolhaDePontoRepository, auditoria: AuditoriaPort) {
    super(sessao, repo, auditoria, "rh.empregado.corrigir");
  }

  async execute(input: CorrigirEmpregadoInput): Promise<Result<void, AppError>> {
    const nome = validarNome(input.nome);
    if (!nome.ok) return nome;
    const jornada = validarJornada(input.jornada);
    if (!jornada.ok) return jornada;

    const autorizado = await this.autorizarPorEmpregado(input.empregadoId);
    if (!autorizado.ok) return autorizado;
    return this.repositorio.corrigirEmpregado(input.empregadoId, {
      nome: nome.value,
      jornada: [...jornada.value],
      comissionado: input.comissionado,
    });
  }
}

export class DefinirEmpregadoAtivo extends EscreverPonto implements DefinirEmpregadoAtivoPort {
  constructor(sessao: SessaoPort, repo: FolhaDePontoRepository, auditoria: AuditoriaPort) {
    super(sessao, repo, auditoria, "rh.empregado.inativar");
  }

  async execute(input: DefinirEmpregadoAtivoInput): Promise<Result<void, AppError>> {
    const autorizado = await this.autorizarPorEmpregado(input.empregadoId);
    if (!autorizado.ok) return autorizado;
    return this.repositorio.definirAtivo(input.empregadoId, input.ativo);
  }
}

export class DefinirSemMovimento extends EscreverPonto implements DefinirSemMovimentoPort {
  constructor(
    sessao: SessaoPort,
    repo: FolhaDePontoRepository,
    auditoria: AuditoriaPort,
    private readonly relogio: RelogioPort,
  ) {
    super(sessao, repo, auditoria, "rh.ponto.sem-movimento");
  }

  async execute(input: DefinirSemMovimentoInput): Promise<Result<void, AppError>> {
    const competencia = Competencia.criar(input.competencia);
    if (!competencia.ok) return competencia;
    if (competencia.value.ehFutura(this.relogio.agora())) {
      return err(new ValidationError("Não dá para dispensar um mês que ainda não começou."));
    }
    const autorizado = await this.autorizarPorEmpregado(input.empregadoId);
    if (!autorizado.ok) return autorizado;
    return this.repositorio.definirSemMovimento(
      input.empregadoId,
      competencia.value.primeiroDia,
      input.sem,
    );
  }
}

export class DefinirPadraoComissionados
  extends EscreverPonto
  implements DefinirPadraoComissionadosPort
{
  constructor(sessao: SessaoPort, repo: FolhaDePontoRepository, auditoria: AuditoriaPort) {
    super(sessao, repo, auditoria, "rh.ponto.padrao-comissionados");
  }

  async execute(input: DefinirPadraoComissionadosInput): Promise<Result<void, AppError>> {
    const ator = await this.autorizar(input.clienteId);
    if (!ator.ok) return ator;
    return this.repositorio.definirPadraoComissionados(input.clienteId, input.comissionados);
  }
}
