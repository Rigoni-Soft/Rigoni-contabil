import type { ConvencoesDoClienteDto } from "@/modules/rh/application/dtos/convencao.dto";
import type {
  ObterConvencoesDoClienteInput,
  ObterConvencoesDoClientePort,
} from "@/modules/rh/application/ports/in/obter-convencoes-do-cliente.provider";
import type { ConvencaoRepository } from "@/modules/rh/application/ports/out/convencao.repository";
import type { FolhaDePontoRepository } from "@/modules/rh/application/ports/out/folha-de-ponto.repository";
import type { SessaoPort } from "@/modules/rh/application/ports/out/sessao.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { NotFoundError } from "@/shared/errors/not-found.error";
import {
  ehResponsavelRhDoCliente,
  podeGerirConvencaoRh,
  podeVerAcompanhamentoRh,
} from "@/shared/kernel/papeis";
import { err, ok, type Result } from "@/shared/kernel/result";

// As convenções do Cliente (histórico com as regras aplicadas), os interruptores e o sindicato que cada
// empregado segue. O Admin e o Líder do RH leem; o Funcionário, só os Clientes de que é Responsável (a RLS
// repete o recorte: cliente fora da vista do ator some).
export class ObterConvencoesDoCliente implements ObterConvencoesDoClientePort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly folha: FolhaDePontoRepository,
    private readonly convencoes: ConvencaoRepository,
  ) {}

  async execute(
    input: ObterConvencoesDoClienteInput,
  ): Promise<Result<ConvencoesDoClienteDto, AppError>> {
    const ator = await this.sessao.usuarioAtual();
    if (!ator || !podeVerAcompanhamentoRh(ator.papel, ator.setor)) {
      return err(new ForbiddenError("Sem acesso às convenções do RH."));
    }

    const cliente = await this.folha.buscarCliente(input.clienteId);
    if (!cliente.ok) return cliente;
    if (!cliente.value) return err(new NotFoundError("Cliente não encontrado."));

    const [convencoes, interruptores, empregados, ponteiros] = await Promise.all([
      this.convencoes.listar(input.clienteId),
      this.folha.buscarInterruptores(input.clienteId),
      this.folha.listarEmpregados(input.clienteId),
      this.folha.listarConvencaoDosEmpregados(input.clienteId),
    ]);
    if (!convencoes.ok) return convencoes;
    if (!interruptores.ok) return interruptores;
    if (!empregados.ok) return empregados;
    if (!ponteiros.ok) return ponteiros;

    const sindicatoDe = new Map(ponteiros.value.map((p) => [p.empregadoId, p.sindicato]));
    return ok({
      clienteId: input.clienteId,
      convencoes: convencoes.value,
      interruptores: interruptores.value,
      empregados: empregados.value
        .filter((e) => e.ativo)
        .map((e) => ({
          id: e.id,
          nome: e.nome,
          convencaoSindicato: sindicatoDe.get(e.id) ?? null,
        })),
      podeEnviar: podeGerirConvencaoRh(ator.papel, ator.setor),
      podeEditar: ehResponsavelRhDoCliente(ator, cliente.value.responsavelId),
    });
  }
}
