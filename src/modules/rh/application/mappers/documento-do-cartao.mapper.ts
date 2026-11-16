import type {
  DocumentoDoCartaoDto,
  ItemDoDocumentoDto,
  LinhaDoDocumentoDto,
  SituacaoDoDiaNoDocumento,
} from "@/modules/rh/application/dtos/documento-do-cartao.dto";
import type {
  DiaDaFolhaDto,
  FolhaDePontoDto,
  ParDto,
} from "@/modules/rh/application/dtos/folha-de-ponto.dto";
import {
  cartaoFeito,
  situacaoDoCartao,
} from "@/modules/rh/domain/services/situacao-do-cartao.service";

type Cartao = NonNullable<FolhaDePontoDto["selecionado"]>;

const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const AVISO_SEM_CONVENCAO_NO_PDF =
  "Sem convenção coletiva vigente em parte do mês: esses dias foram totalizados pela legislação.";

const doisDigitos = (n: number) => String(n).padStart(2, "0");
const horario = (minutos: number) =>
  `${doisDigitos(Math.floor(minutos / 60))}:${doisDigitos(minutos % 60)}`;
const duracaoEmHorasEMinutos = (minutos: number) =>
  `${Math.floor(minutos / 60)}h${doisDigitos(minutos % 60)}`;
const quantidadeDeDias = (quantidade: number) =>
  `${quantidade} ${quantidade === 1 ? "dia" : "dias"}`;
const horarioDoPar = (par: ParDto | undefined, campo: keyof ParDto) =>
  par ? horario(par[campo]) : "";

// Não há PDF para assinar de empregado desligado, sem movimento no mês (férias, afastamento) ou sem nenhum
// apontamento (batida, Extra ou Abono) no mês: devolve o porquê, ou undefined quando o PDF cabe.
export function motivoSemPdf(cartao: Cartao): string | undefined {
  const situacao = situacaoDoCartao({
    ativo: cartao.empregado.ativo,
    semMovimento: cartao.empregado.semMovimento,
    iniciado: cartao.iniciado,
    dias: cartao.dias,
  });
  if (situacao === "desligado") return "Empregado desligado: não há cartão para assinar.";
  if (situacao === "sem_movimento") {
    return "Empregado sem movimento no mês (férias ou afastamento): não há cartão para assinar.";
  }
  if (!cartaoFeito(situacao)) return "Sem apontamentos no mês: não há cartão para assinar.";
  return undefined;
}

function situacaoDoDia(dia: DiaDaFolhaDto): SituacaoDoDiaNoDocumento {
  const semBatida = dia.batidas.length === 0 && dia.extra === null;
  if (dia.abono && semBatida && dia.diaDeTrabalho) return "Abono";
  if (dia.diaDeTrabalho && dia.apuracao.faltas > 0) return "Falta";
  if (dia.feriado) return "Feriado";
  return dia.cargaMin === 0 ? "Folga" : "";
}

function linhaDoDia(dia: DiaDaFolhaDto): LinhaDoDocumentoDto {
  const [, mes, diaDoMes] = dia.data.split("-");
  return {
    data: `${diaDoMes}/${mes}`,
    diaDaSemana: SEMANA[dia.diaDaSemana],
    batidas: [
      horarioDoPar(dia.batidas[0], "entrada"),
      horarioDoPar(dia.batidas[0], "saida"),
      horarioDoPar(dia.batidas[1], "entrada"),
      horarioDoPar(dia.batidas[1], "saida"),
    ],
    extra: dia.extra ? `${horario(dia.extra.entrada)}-${horario(dia.extra.saida)}` : "",
    horasDiarias: duracaoEmHorasEMinutos(dia.trabalhadoMin),
    situacao: situacaoDoDia(dia),
  };
}

function itensDaTotalizacao(cartao: Cartao): ItemDoDocumentoDto[] {
  const totalizacao = cartao.totalizacao;
  const trabalhado = cartao.dias.reduce((soma, dia) => soma + dia.trabalhadoMin, 0);
  const extras: [string, number][] = totalizacao.extras.length
    ? totalizacao.extras.map((faixa) => [`Extras ${faixa.percentual}%`, faixa.minutos])
    : [["Horas extras", 0]];
  // Banco de horas e extras acima do limite só aparecem quando há minutos.
  const opcionais: [string, number][] = [
    ["Banco de horas", totalizacao.bancoDeHorasMin],
    ["Extras acima do limite diário", totalizacao.acimaDoLimiteMin],
  ];
  const duracoes: [string, number][] = [
    ["Horas trabalhadas", trabalhado],
    ["Horas normais", totalizacao.normaisMin],
    ...extras,
    ...opcionais.filter(([, minutos]) => minutos > 0),
    ["Adicional noturno", totalizacao.noturnoMin],
    ["Atrasos", totalizacao.atrasoMin],
  ];
  return [
    ...duracoes.map(([rotulo, minutos]) => ({ rotulo, valor: duracaoEmHorasEMinutos(minutos) })),
    { rotulo: "Faltas", valor: quantidadeDeDias(totalizacao.faltas) },
    {
      rotulo: "Abonos",
      valor: `${quantidadeDeDias(totalizacao.abonoDias)} · ${duracaoEmHorasEMinutos(totalizacao.abonoMin)}`,
    },
    { rotulo: "Feriados trabalhados", valor: String(totalizacao.feriadosTrabalhados) },
    { rotulo: "Sábados trabalhados", valor: String(totalizacao.sabadosTrabalhados) },
    { rotulo: "Dias com lanche", valor: String(totalizacao.diasComLanche) },
  ];
}

export function documentoDoCartao(folha: FolhaDePontoDto, cartao: Cartao): DocumentoDoCartaoDto {
  const [ano, mes] = folha.competencia.split("-");
  return {
    empresa: folha.empresa,
    empregado: cartao.empregado.nome,
    periodo: `${mes}/${ano}`,
    linhas: cartao.dias.map(linhaDoDia),
    totalizacao: itensDaTotalizacao(cartao),
    avisoDaTotalizacao: cartao.semConvencao ? AVISO_SEM_CONVENCAO_NO_PDF : undefined,
  };
}
