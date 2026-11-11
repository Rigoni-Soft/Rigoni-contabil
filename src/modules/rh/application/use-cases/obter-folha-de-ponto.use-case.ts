import type {
  DiaDaFolhaDto,
  FolhaDePontoDto,
} from "@/modules/rh/application/dtos/folha-de-ponto.dto";
import type {
  ObterFolhaDePontoInput,
  ObterFolhaDePontoPort,
} from "@/modules/rh/application/ports/in/obter-folha-de-ponto.provider";
import type { ConvencaoRepository } from "@/modules/rh/application/ports/out/convencao.repository";
import type { FolhaDePontoRepository } from "@/modules/rh/application/ports/out/folha-de-ponto.repository";
import type { RelogioPort } from "@/modules/rh/application/ports/out/relogio.provider";
import type { SessaoPort } from "@/modules/rh/application/ports/out/sessao.provider";
import {
  convencaoDaEpoca,
  regrasDeCalculo,
} from "@/modules/rh/domain/services/regras-de-calculo.service";
import {
  diaDaSemana,
  totalizar,
  type Jornada,
} from "@/modules/rh/domain/services/totalizacao.service";
import { Competencia } from "@/modules/rh/domain/value-objects/competencia.vo";
import { diasDaQuinzena } from "@/modules/rh/domain/value-objects/quinzena.vo";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { NotFoundError } from "@/shared/errors/not-found.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { diaDoMes } from "@/shared/kernel/mes-atual";
import { podeMarcarAcompanhamentoRh, podeVerAcompanhamentoRh } from "@/shared/kernel/papeis";
import { err, ok, type Result } from "@/shared/kernel/result";

// A Folha de ponto de um Cliente: o quadro, o cartão da quinzena do empregado escolhido e a Totalização
// dele pela convenção vigente em cada dia do cartão (a legislação onde nenhuma vale). O Admin e o Líder do RH leem; o Funcionário, só os Clientes de que é Responsável (a
// RLS repete o recorte: cliente fora da vista do ator some).
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
    // Sem quinzena pedida, a que está em andamento no mês corrente; nos meses passados, a primeira.
    const noMesAtual = Competencia.atual(agora).valor === competencia.value.valor;
    const quinzena = input.quinzena ?? (noMesAtual && diaDoMes(agora) > 15 ? 2 : 1);

    const cliente = await this.repositorio.buscarCliente(input.clienteId);
    if (!cliente.ok) return cliente;
    if (!cliente.value) return err(new NotFoundError("Cliente não encontrado."));

    const [empregados, semMovimento, padrao] = await Promise.all([
      this.repositorio.listarEmpregados(input.clienteId),
      this.repositorio.listarSemMovimento(input.clienteId, competencia.value.primeiroDia),
      this.repositorio.buscarPadraoComissionados(input.clienteId),
    ]);
    if (!empregados.ok) return empregados;
    if (!semMovimento.ok) return semMovimento;
    if (!padrao.ok) return padrao;

    const sem = new Set(semMovimento.value);
    const quadro = empregados.value.map((e) => ({ ...e, semMovimento: sem.has(e.id) }));
    const base = {
      clienteId: input.clienteId,
      competencia: competencia.value.valor,
      quinzena,
      padraoComissionados: padrao.value,
      empregados: quadro,
      podeEditar:
        podeMarcarAcompanhamentoRh(ator.papel, ator.setor) &&
        cliente.value.responsavelId === ator.id,
    };

    const escolhido = input.empregadoId
      ? quadro.find((e) => e.id === input.empregadoId)
      : quadro.find((e) => e.ativo);
    if (input.empregadoId && !escolhido) return err(new NotFoundError("Empregado não encontrado."));
    if (!escolhido) return ok({ ...base, selecionado: null });

    const datas = diasDaQuinzena(competencia.value.valor, quinzena);
    const [lancados, feriados, historico, interruptores, ponteiros] = await Promise.all([
      this.repositorio.listarDias(escolhido.id, datas[0], datas[datas.length - 1]),
      this.repositorio.listarFeriados(datas[0], datas[datas.length - 1]),
      this.convencoes.listar(input.clienteId),
      this.repositorio.buscarInterruptores(input.clienteId),
      this.repositorio.listarConvencaoDosEmpregados(input.clienteId),
    ]);
    if (!lancados.ok) return lancados;
    if (!feriados.ok) return feriados;
    if (!historico.ok) return historico;
    if (!interruptores.ok) return interruptores;
    if (!ponteiros.ok) return ponteiros;

    const sindicato =
      ponteiros.value.find((p) => p.empregadoId === escolhido.id)?.sindicato ?? null;
    const regrasDoDia = (data: string) =>
      regrasDeCalculo(
        convencaoDaEpoca(historico.value, sindicato, data)?.regras ?? null,
        interruptores.value,
        escolhido.comissionado,
      );
    const semConvencao = datas.some((data) => !convencaoDaEpoca(historico.value, sindicato, data));

    const lancadoEm = new Map(lancados.value.map((d) => [d.data, d]));
    const feriadoEm = new Set(feriados.value);
    const dias: DiaDaFolhaDto[] = datas.map((data) => {
      const dia = lancadoEm.get(data);
      const semana = diaDaSemana(data);
      return {
        data,
        batidas: dia?.batidas ?? [],
        extra: dia?.extra ?? null,
        abono: dia?.abono ?? false,
        diaDaSemana: semana,
        feriado: feriadoEm.has(data),
        cargaMin: escolhido.jornada[semana],
      };
    });

    return ok({
      ...base,
      selecionado: {
        empregado: escolhido,
        dias,
        totalizacao: totalizar(dias, escolhido.jornada as unknown as Jornada, regrasDoDia),
        semConvencao,
      },
    });
  }
}
