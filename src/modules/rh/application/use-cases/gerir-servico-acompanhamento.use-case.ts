import type {
  CriarServicoAcompanhamentoInput,
  CriarServicoAcompanhamentoPort,
  DesativarServicoAcompanhamentoInput,
  DesativarServicoAcompanhamentoPort,
  RenomearServicoAcompanhamentoInput,
  RenomearServicoAcompanhamentoPort,
} from "@/modules/rh/application/ports/in/gerir-servico-acompanhamento.provider";
import type { AcompanhamentoRepository } from "@/modules/rh/application/ports/out/acompanhamento.repository";
import type { AuditoriaPort } from "@/modules/rh/application/ports/out/auditoria.provider";
import type { AtorSessaoDto, SessaoPort } from "@/modules/rh/application/ports/out/sessao.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { podeGerirServicosRh } from "@/shared/kernel/papeis";
import { err, ok, type Result } from "@/shared/kernel/result";

const MAXIMO_NOME = 40;

function nomeValido(nome: string): Result<string, ValidationError> {
  const limpo = nome.trim();
  if (limpo.length === 0 || limpo.length > MAXIMO_NOME) {
    return err(
      new ValidationError(`O nome do serviço tem de 1 a ${MAXIMO_NOME} caracteres.`, {
        nome: ["Nome inválido"],
      }),
    );
  }
  return ok(limpo);
}

// Só o Líder do RH mantém a lista de serviços. O banco repete a regra (RLS + gatilho; o serviço do
// sistema nunca muda) e audita o sucesso na mesma transação; aqui, só a falha.
abstract class GerirServico {
  constructor(
    protected readonly sessao: SessaoPort,
    protected readonly repositorio: AcompanhamentoRepository,
    private readonly auditoria: AuditoriaPort,
    private readonly acao: string,
  ) {}

  protected async executar(
    alvo: string,
    escrever: () => Promise<Result<void, AppError>>,
  ): Promise<Result<void, AppError>> {
    const ator = await this.sessao.usuarioAtual();
    if (!ator || !podeGerirServicosRh(ator.papel, ator.setor)) {
      if (ator) await this.registrarFalha(ator, alvo);
      return err(new ForbiddenError("Só o Líder do RH mantém os serviços do acompanhamento."));
    }
    const resultado = await escrever();
    if (!resultado.ok) await this.registrarFalha(ator, alvo);
    return resultado;
  }

  private async registrarFalha(ator: AtorSessaoDto, alvo: string): Promise<void> {
    await this.auditoria.registrar({
      ator: ator.id,
      setor: ator.setor,
      acao: this.acao,
      alvo,
      resultado: "falha",
    });
  }
}

export class CriarServicoAcompanhamento
  extends GerirServico
  implements CriarServicoAcompanhamentoPort
{
  constructor(sessao: SessaoPort, repositorio: AcompanhamentoRepository, auditoria: AuditoriaPort) {
    super(sessao, repositorio, auditoria, "rh.servico.criar");
  }

  async execute(input: CriarServicoAcompanhamentoInput): Promise<Result<void, AppError>> {
    const nome = nomeValido(input.nome);
    if (!nome.ok) return nome;
    return this.executar(nome.value, () => this.repositorio.criarServico(nome.value));
  }
}

export class RenomearServicoAcompanhamento
  extends GerirServico
  implements RenomearServicoAcompanhamentoPort
{
  constructor(sessao: SessaoPort, repositorio: AcompanhamentoRepository, auditoria: AuditoriaPort) {
    super(sessao, repositorio, auditoria, "rh.servico.renomear");
  }

  async execute(input: RenomearServicoAcompanhamentoInput): Promise<Result<void, AppError>> {
    const nome = nomeValido(input.nome);
    if (!nome.ok) return nome;
    return this.executar(input.servicoId, () =>
      this.repositorio.renomearServico(input.servicoId, nome.value),
    );
  }
}

export class DesativarServicoAcompanhamento
  extends GerirServico
  implements DesativarServicoAcompanhamentoPort
{
  constructor(sessao: SessaoPort, repositorio: AcompanhamentoRepository, auditoria: AuditoriaPort) {
    super(sessao, repositorio, auditoria, "rh.servico.desativar");
  }

  async execute(input: DesativarServicoAcompanhamentoInput): Promise<Result<void, AppError>> {
    return this.executar(input.servicoId, () => this.repositorio.desativarServico(input.servicoId));
  }
}
