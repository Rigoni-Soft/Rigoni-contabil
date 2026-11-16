import type {
  DiaDaFolhaDto,
  DiaDoPontoDto,
  EmpregadoDaFolhaDto,
  FolhaDePontoDto,
} from "@/modules/rh/application/dtos/folha-de-ponto.dto";
import { motivoSemPdf } from "@/modules/rh/application/mappers/documento-do-cartao.mapper";
import type { ConvencaoRepository } from "@/modules/rh/application/ports/out/convencao.repository";
import type { FolhaDePontoRepository } from "@/modules/rh/application/ports/out/folha-de-ponto.repository";
import {
  convencaoDaEpoca,
  regrasDeCalculo,
  type RegrasDeCalculo,
} from "@/modules/rh/domain/services/regras-de-calculo.service";
import {
  diaDaSemana,
  ehDiaDeTrabalho,
  minutosTrabalhados,
  totalizar,
  totalizarDia,
} from "@/modules/rh/domain/services/totalizacao.service";
import type { Competencia } from "@/modules/rh/domain/value-objects/competencia.vo";
import type { AppError } from "@/shared/errors/app.error";
import { ok, type Result } from "@/shared/kernel/result";

export type CartaoApurado = NonNullable<FolhaDePontoDto["selecionado"]>;

// O cartão do mês apurado: os dias, a Totalização pela convenção vigente em cada dia (a legislação onde nenhuma
// vale) e o motivo de não haver PDF. Os insumos do Cliente (feriados, convenções, interruptores, ponteiros de
// convenção) são lidos uma vez, sirvam a 1 ou a N empregados; só os dias e a marca "iniciado" são por empregado.
export class ApuradorDeCartoes {
  constructor(
    private readonly repositorio: FolhaDePontoRepository,
    private readonly convencoes: ConvencaoRepository,
  ) {}

  async apurar(
    clienteId: string,
    empregados: EmpregadoDaFolhaDto[],
    competencia: Competencia,
  ): Promise<Result<CartaoApurado[], AppError>> {
    const datas = competencia.dias;
    const [feriados, historico, interruptores, ponteiros] = await Promise.all([
      this.repositorio.listarFeriados(datas[0], datas[datas.length - 1]),
      this.convencoes.listar(clienteId),
      this.repositorio.buscarInterruptores(clienteId),
      this.repositorio.listarConvencaoDosEmpregados(clienteId),
    ]);
    if (!feriados.ok) return feriados;
    if (!historico.ok) return historico;
    if (!interruptores.ok) return interruptores;
    if (!ponteiros.ok) return ponteiros;
    const feriadoEm = new Set(feriados.value);

    const cartoes = await Promise.all(
      empregados.map(async (empregado): Promise<Result<CartaoApurado, AppError>> => {
        const [lancados, iniciado] = await Promise.all([
          this.repositorio.listarDias(empregado.id, datas[0], datas[datas.length - 1]),
          this.repositorio.cartaoIniciado(empregado.id, competencia.primeiroDia),
        ]);
        if (!lancados.ok) return lancados;
        if (!iniciado.ok) return iniciado;

        const sindicato =
          ponteiros.value.find((p) => p.empregadoId === empregado.id)?.sindicato ?? null;
        const convencaoEm = (data: string) => convencaoDaEpoca(historico.value, sindicato, data);
        const regrasDoDia = (data: string) =>
          regrasDeCalculo(
            convencaoEm(data)?.regras ?? null,
            interruptores.value,
            empregado.comissionado,
          );
        const lancadoEm = new Map(lancados.value.map((d) => [d.data, d]));

        // Só avisa quando um dia com lançamento ficou sem convenção: dia vazio não muda com ela.
        const semConvencao = datas.some(
          (data) => !convencaoEm(data) && (lancadoEm.get(data) || feriadoEm.has(data)),
        );
        const dias = datas.map((data) =>
          montarDia(data, empregado, lancadoEm.get(data), feriadoEm.has(data), regrasDoDia(data)),
        );
        const cartao = {
          empregado,
          dias,
          totalizacao: totalizar(dias, empregado.jornada, regrasDoDia),
          iniciado: iniciado.value,
          semConvencao,
        };
        return ok({ ...cartao, motivoSemPdf: motivoSemPdf(cartao) });
      }),
    );
    const valores: CartaoApurado[] = [];
    for (const cartao of cartoes) {
      if (!cartao.ok) return cartao;
      valores.push(cartao.value);
    }
    return ok(valores);
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
    diaDeTrabalho: ehDiaDeTrabalho(empregado.jornada[semana], feriado),
    trabalhadoMin: minutosTrabalhados(doCartao),
    apuracao: totalizarDia(doCartao, empregado.jornada, regras),
  };
}
