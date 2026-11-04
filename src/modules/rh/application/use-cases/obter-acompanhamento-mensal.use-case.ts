import type { AcompanhamentoMensalDto } from "@/modules/rh/application/dtos/acompanhamento.dto";
import type {
  ObterAcompanhamentoMensalInput,
  ObterAcompanhamentoMensalPort,
} from "@/modules/rh/application/ports/in/obter-acompanhamento-mensal.provider";
import type { AcompanhamentoRepository } from "@/modules/rh/application/ports/out/acompanhamento.repository";
import type { RelogioPort } from "@/modules/rh/application/ports/out/relogio.provider";
import type { SessaoPort } from "@/modules/rh/application/ports/out/sessao.provider";
import { Competencia } from "@/modules/rh/domain/value-objects/competencia.vo";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { ValidationError } from "@/shared/errors/validation.error";
import {
  podeGerirServicosRh,
  podeMarcarAcompanhamentoRh,
  podeVerAcompanhamentoRh,
} from "@/shared/kernel/papeis";
import { err, ok, type Result } from "@/shared/kernel/result";

// A tabela do RH: uma linha por Cliente com Responsável do RH, uma coluna por Serviço do mês. O Funcionário
// vê só os seus; o Líder e o Admin, todos. Mês sem marcação é pendente. A RLS repete o recorte.
export class ObterAcompanhamentoMensal implements ObterAcompanhamentoMensalPort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly repositorio: AcompanhamentoRepository,
    private readonly relogio: RelogioPort,
  ) {}

  async execute(
    input: ObterAcompanhamentoMensalInput,
  ): Promise<Result<AcompanhamentoMensalDto, AppError>> {
    const ator = await this.sessao.usuarioAtual();
    if (!ator || !podeVerAcompanhamentoRh(ator.papel, ator.setor)) {
      return err(new ForbiddenError("Sem acesso ao acompanhamento do RH."));
    }

    const agora = this.relogio.agora();
    const competencia = input.competencia
      ? Competencia.criar(input.competencia)
      : ok(Competencia.atual(agora));
    if (!competencia.ok) return competencia;
    if (competencia.value.ehFutura(agora)) {
      return err(new ValidationError("Não há acompanhamento de um mês que ainda não começou."));
    }

    const dia = competencia.value.primeiroDia;
    const [servicos, clientes] = await Promise.all([
      this.repositorio.listarServicos(dia),
      this.repositorio.listarClientes(dia, ator.papel === "funcionario" ? ator.id : null),
    ]);
    if (!servicos.ok) return servicos;
    if (!clientes.ok) return clientes;

    return ok({
      competencia: competencia.value.valor,
      servicos: servicos.value,
      linhas: clientes.value.map((cliente) => {
        const naoAplica = new Set(cliente.naoAplica);
        const concluidos = new Set(cliente.concluidos);
        return {
          clienteId: cliente.clienteId,
          empresa: cliente.empresa,
          cnpj: cliente.cnpj,
          celulas: servicos.value.map((servico) => ({
            servicoId: servico.id,
            aplica: !naoAplica.has(servico.id),
            concluido: concluidos.has(servico.id),
          })),
        };
      }),
      podeMarcar: podeMarcarAcompanhamentoRh(ator.papel, ator.setor),
      podeGerirServicos: podeGerirServicosRh(ator.papel, ator.setor),
    });
  }
}
