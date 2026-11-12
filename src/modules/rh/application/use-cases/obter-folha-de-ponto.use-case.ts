import type {
  DiaDaFolhaDto,
  DiaDoPontoDto,
  EmpregadoDaFolhaDto,
  FolhaDePontoDto,
} from "@/modules/rh/application/dtos/folha-de-ponto.dto";
import type {
  ObterFolhaDePontoInput,
  ObterFolhaDePontoPort,
} from "@/modules/rh/application/ports/in/obter-folha-de-ponto.provider";
import type { ConvencaoRepository } from "@/modules/rh/application/ports/out/convencao.repository";
import type { FolhaDePontoRepository } from "@/modules/rh/application/ports/out/folha-de-ponto.repository";
import type { RelogioPort } from "@/modules/rh/application/ports/out/relogio.provider";
import type { AtorSessaoDto, SessaoPort } from "@/modules/rh/application/ports/out/sessao.provider";
import {
  convencaoDaEpoca,
  regrasDeCalculo,
  type RegrasDeCalculo,
} from "@/modules/rh/domain/services/regras-de-calculo.service";
import {
  diaDaSemana,
  minutosTrabalhados,
  totalizar,
  totalizarDia,
} from "@/modules/rh/domain/services/totalizacao.service";
import { Competencia } from "@/modules/rh/domain/value-objects/competencia.vo";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { NotFoundError } from "@/shared/errors/not-found.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { podeMarcarAcompanhamentoRh, podeVerAcompanhamentoRh } from "@/shared/kernel/papeis";
import { err, ok, type Result } from "@/shared/kernel/result";

// A Folha de ponto de um Cliente: o quadro, o cartão do mês do empregado escolhido e a Totalização
// dele pela convenção vigente em cada dia do cartão (a legislação onde nenhuma vale). O Admin e o Líder do
// RH leem; o Funcionário, só os Clientes de que é Responsável (a RLS repete o recorte: cliente fora da vista
// do ator some).
export class ObterFolhaDePonto implements ObterFolhaDePontoPort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly repositorio: FolhaDePontoRepository,
    private readonly convencoes: ConvencaoRepository,
    private readonly relogio: RelogioPort,
  ) {}

  async execute(input: ObterFolhaDePontoInput): Promise<Result<FolhaDePontoDto, AppError>> {
    const ator = await this.sessao.usuarioAtual();
    if (!ator || !podeVerAcompanhamentoRh(ator.papel, ator.setor)) {
      return err(new ForbiddenError("Sem acesso à Folha de ponto do RH."));
    }

    const agora = this.relogio.agora();
    const competencia = input.competencia
      ? Competencia.criar(input.competencia)
      : ok(Competencia.atual(agora));
    if (!competencia.ok) return competencia;
    if (competencia.value.ehFutura(agora)) {
      return err(new ValidationError("Não há cartão de um mês que ainda não começou."));
    }

    const quadro = await this.carregarQuadro(input.clienteId, ator, competencia.value);
    if (!quadro.ok) return quadro;
    const { base, empregados } = quadro.value;

    // Sem empregado pedido o quadro abre no formulário "Novo empregado": nada é escolhido por padrão.
    if (!input.empregadoId) return ok({ ...base, selecionado: null });
    const escolhido = empregados.find((e) => e.id === input.empregadoId);
    if (!escolhido) return err(new NotFoundError("Empregado não encontrado."));

    const selecionado = await this.carregarCartao(input.clienteId, escolhido, competencia.value);
    return selecionado.ok ? ok({ ...base, selecionado: selecionado.value }) : selecionado;
  }

  private async carregarQuadro(
    clienteId: string,
    ator: AtorSessaoDto,
    competencia: Competencia,
  ): Promise<
    Result<
      { base: Omit<FolhaDePontoDto, "selecionado">; empregados: EmpregadoDaFolhaDto[] },
      AppError
    >
  > {
    const cliente = await this.repositorio.buscarCliente(clienteId);
    if (!cliente.ok) return cliente;
    if (!cliente.value) return err(new NotFoundError("Cliente não encontrado."));

    const [empregados, semMovimento, padrao] = await Promise.all([
      this.repositorio.listarEmpregados(clienteId),
      this.repositorio.listarSemMovimento(clienteId, competencia.primeiroDia),
      this.repositorio.buscarPadraoComissionados(clienteId),
    ]);
    if (!empregados.ok) return empregados;
    if (!semMovimento.ok) return semMovimento;
    if (!padrao.ok) return padrao;

    const sem = new Set(semMovimento.value);
    const quadro = empregados.value.map((e) => ({ ...e, semMovimento: sem.has(e.id) }));
    const base = {
      clienteId,
      empresa: cliente.value.empresa,
      competencia: competencia.valor,
      padraoComissionados: padrao.value,
      empregados: quadro,
      podeEditar:
        podeMarcarAcompanhamentoRh(ator.papel, ator.setor) &&
        cliente.value.responsavelId === ator.id,
    };
    return ok({ base, empregados: quadro });
  }

  private async carregarCartao(
    clienteId: string,
    escolhido: EmpregadoDaFolhaDto,
    competencia: Competencia,
  ): Promise<Result<NonNullable<FolhaDePontoDto["selecionado"]>, AppError>> {
    const datas = competencia.dias;
    const [lancados, feriados, historico, interruptores, ponteiros, iniciado] = await Promise.all([
      this.repositorio.listarDias(escolhido.id, datas[0], datas[datas.length - 1]),
      this.repositorio.listarFeriados(datas[0], datas[datas.length - 1]),
      this.convencoes.listar(clienteId),
      this.repositorio.buscarInterruptores(clienteId),
      this.repositorio.listarConvencaoDosEmpregados(clienteId),
      this.repositorio.cartaoIniciado(escolhido.id, competencia.primeiroDia),
    ]);
    if (!lancados.ok) return lancados;
    if (!feriados.ok) return feriados;
    if (!historico.ok) return historico;
    if (!interruptores.ok) return interruptores;
    if (!ponteiros.ok) return ponteiros;
    if (!iniciado.ok) return iniciado;

    const sindicato =
      ponteiros.value.find((p) => p.empregadoId === escolhido.id)?.sindicato ?? null;
    const convencaoDe = new Map(
      datas.map((data) => [data, convencaoDaEpoca(historico.value, sindicato, data)]),
    );
    const regrasDoDia = (data: string) =>
      regrasDeCalculo(
        convencaoDe.get(data)?.regras ?? null,
        interruptores.value,
        escolhido.comissionado,
      );

    const lancadoEm = new Map(lancados.value.map((d) => [d.data, d]));
    const feriadoEm = new Set(feriados.value);

    // Só avisa quando um dia com lançamento ficou sem convenção: dia vazio não muda com ela.
    const semConvencao = datas.some(
      (data) => !convencaoDe.get(data) && (lancadoEm.get(data) || feriadoEm.has(data)),
    );
    const dias = datas.map((data) =>
      montarDia(data, escolhido, lancadoEm.get(data), feriadoEm.has(data), regrasDoDia(data)),
    );

    return ok({
      empregado: escolhido,
      dias,
      totalizacao: totalizar(dias, escolhido.jornada, regrasDoDia),
      iniciado: iniciado.value,
      semConvencao,
    });
  }
}

function montarDia(
  data: string,
  empregado: EmpregadoDaFolhaDto,
  lancado: DiaDoPontoDto | undefined,
  feriado: boolean,
  regras: RegrasDeCalculo,
): DiaDaFolhaDto {
  const semana = diaDaSemana(data);
  const doCartao = {
    data,
    batidas: lancado?.batidas ?? [],
    extra: lancado?.extra ?? null,
    abono: lancado?.abono ?? false,
    feriado,
  };
  return {
    ...doCartao,
    diaDaSemana: semana,
    cargaMin: empregado.jornada[semana],
    trabalhadoMin: minutosTrabalhados(doCartao),
    apuracao: totalizarDia(doCartao, empregado.jornada, regras),
  };
}
