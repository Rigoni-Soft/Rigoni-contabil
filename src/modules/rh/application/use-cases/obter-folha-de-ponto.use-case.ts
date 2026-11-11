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
  minutosTrabalhados,
  totalizar,
  totalizarDia,
  type Jornada,
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
      empresa: cliente.value.empresa,
      competencia: competencia.value.valor,
      padraoComissionados: padrao.value,
      empregados: quadro,
      podeEditar:
        podeMarcarAcompanhamentoRh(ator.papel, ator.setor) &&
        cliente.value.responsavelId === ator.id,
    };

    // Sem empregado pedido o quadro abre no formulário "Novo empregado": nada é escolhido por padrão.
    if (!input.empregadoId) return ok({ ...base, selecionado: null });
    const escolhido = quadro.find((e) => e.id === input.empregadoId);
    if (!escolhido) return err(new NotFoundError("Empregado não encontrado."));

    const datas = competencia.value.dias;
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
    const dias: DiaDaFolhaDto[] = datas.map((data) => {
      const dia = lancadoEm.get(data);
      const semana = diaDaSemana(data);
      const doCartao = {
        data,
        batidas: dia?.batidas ?? [],
        extra: dia?.extra ?? null,
        abono: dia?.abono ?? false,
        feriado: feriadoEm.has(data),
      };
      const jornada = escolhido.jornada as unknown as Jornada;
      return {
        ...doCartao,
        diaDaSemana: semana,
        cargaMin: escolhido.jornada[semana],
        trabalhadoMin: minutosTrabalhados(doCartao),
        apuracao: totalizarDia(doCartao, jornada, regrasDoDia(data)),
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
