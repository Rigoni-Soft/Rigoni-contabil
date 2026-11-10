import type {
  DefinirServicoAplicavelInput,
  DefinirServicoAplicavelPort,
  MarcarServicoAcompanhamentoInput,
  MarcarServicoAcompanhamentoPort,
} from "@/modules/rh/application/ports/in/marcar-servico-acompanhamento.provider";
import type { AcompanhamentoRepository } from "@/modules/rh/application/ports/out/acompanhamento.repository";
import type { AuditoriaPort } from "@/modules/rh/application/ports/out/auditoria.provider";
import type { RelogioPort } from "@/modules/rh/application/ports/out/relogio.provider";
import type { AtorSessaoDto, SessaoPort } from "@/modules/rh/application/ports/out/sessao.provider";
import { Competencia } from "@/modules/rh/domain/value-objects/competencia.vo";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { NotFoundError } from "@/shared/errors/not-found.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { podeMarcarAcompanhamentoRh } from "@/shared/kernel/papeis";
import { err, ok, type Result } from "@/shared/kernel/result";

// Só o Funcionário do RH que é Responsável do Cliente grava (marcar e "se aplica"); o Líder e o Admin
// leem. O banco repete a regra (RLS) e audita o sucesso na mesma transação; aqui, a primeira barreira e
// a auditoria da tentativa recusada.
abstract class EscreverAcompanhamento {
  constructor(
    protected readonly sessao: SessaoPort,
    protected readonly repositorio: AcompanhamentoRepository,
    private readonly auditoria: AuditoriaPort,
    private readonly acao: string,
  ) {}

  // Devolve o ator quando ele pode escrever neste Cliente.
  protected async autorizar(
    clienteId: string,
    acao: string = this.acao,
  ): Promise<Result<AtorSessaoDto, AppError>> {
    const ator = await this.sessao.usuarioAtual();
    if (!ator) return err(new ForbiddenError("Sessão inválida. Entre novamente."));

    const cliente = await this.repositorio.buscarCliente(clienteId);
    if (!cliente.ok) return cliente;
    const responsavel = cliente.value?.responsavelId;
    if (!podeMarcarAcompanhamentoRh(ator.papel, ator.setor) || responsavel !== ator.id) {
      await this.auditoria.registrar({
        ator: ator.id,
        setor: ator.setor,
        acao,
        alvo: cliente.value?.cnpj ?? clienteId,
        resultado: "falha",
      });
      return err(new ForbiddenError("Só o Responsável do RH do cliente altera o acompanhamento."));
    }
    return ok(ator);
  }

  // Só serviço de marcar à mão e presente na tabela daquele mês.
  protected async servicoEditavel(
    servicoId: string,
    competenciaDia: string,
  ): Promise<Result<void, AppError>> {
    const servicos = await this.repositorio.listarServicos(competenciaDia);
    if (!servicos.ok) return servicos;
    const servico = servicos.value.find((s) => s.id === servicoId);
    if (!servico) return err(new NotFoundError("Este serviço não está no acompanhamento do mês."));
    if (servico.sistema) {
      return err(new ValidationError("O Holerite é preenchido pelo sistema, não à mão."));
    }
    return ok(undefined);
  }
}

export class MarcarServicoAcompanhamento
  extends EscreverAcompanhamento
  implements MarcarServicoAcompanhamentoPort
{
  constructor(
    sessao: SessaoPort,
    repositorio: AcompanhamentoRepository,
    auditoria: AuditoriaPort,
    private readonly relogio: RelogioPort,
  ) {
    super(sessao, repositorio, auditoria, "rh.acompanhamento.marcar");
  }

  async execute(input: MarcarServicoAcompanhamentoInput): Promise<Result<void, AppError>> {
    const competencia = Competencia.criar(input.competencia);
    if (!competencia.ok) return competencia;
    if (competencia.value.ehFutura(this.relogio.agora())) {
      return err(new ValidationError("Não dá para marcar um mês que ainda não começou."));
    }

    const ator = await this.autorizar(input.clienteId);
    if (!ator.ok) return ator;

    const servico = await this.servicoEditavel(input.servicoId, competencia.value.primeiroDia);
    if (!servico.ok) return servico;

    return this.repositorio.marcar(
      input.clienteId,
      input.servicoId,
      competencia.value.primeiroDia,
      input.concluido,
      ator.value.id,
    );
  }
}

export class DefinirServicoAplicavel
  extends EscreverAcompanhamento
  implements DefinirServicoAplicavelPort
{
  constructor(sessao: SessaoPort, repositorio: AcompanhamentoRepository, auditoria: AuditoriaPort) {
    super(sessao, repositorio, auditoria, "rh.acompanhamento.nao-aplicar");
  }

  async execute(input: DefinirServicoAplicavelInput): Promise<Result<void, AppError>> {
    const competencia = Competencia.criar(input.competencia);
    if (!competencia.ok) return competencia;

    const ator = await this.autorizar(
      input.clienteId,
      input.escopo === "aplica" ? "rh.acompanhamento.aplicar" : "rh.acompanhamento.nao-aplicar",
    );
    if (!ator.ok) return ator;

    // Só serviço de marcar à mão e presente na tabela daquele mês (o do sistema e o inexistente têm resposta própria).
    const servico = await this.servicoEditavel(input.servicoId, competencia.value.primeiroDia);
    if (!servico.ok) return servico;

    return this.repositorio.definirAplica(
      input.clienteId,
      input.servicoId,
      competencia.value.primeiroDia,
      input.escopo,
    );
  }
}
