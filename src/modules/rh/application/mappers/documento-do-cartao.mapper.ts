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

type Cartao = NonNullable<FolhaDePontoDto["selecionado"]>;

const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const AVISO_SEM_CONVENCAO_NO_PDF =
  "Sem convenção coletiva vigente em parte do mês: esses dias foram totalizados pela legislação.";

const horario = (minutos: number) =>
  `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
const duracaoEmHorasEMinutos = (minutos: number) =>
  `${Math.floor(minutos / 60)}h${String(minutos % 60).padStart(2, "0")}`;
const quantidadeDeDias = (quantidade: number) =>
  `${quantidade} ${quantidade === 1 ? "dia" : "dias"}`;
const horarioDoPar = (par: ParDto | undefined, campo: keyof ParDto) =>
  par ? horario(par[campo]) : "";

const temDados = (dia: DiaDaFolhaDto) => dia.batidas.length > 0 || dia.extra !== null || dia.abono;

// Cartão ainda não iniciado e sem nenhum dado: os dias úteis vazios ainda não são falta (como na tela).
function situacaoDoDia(dia: DiaDaFolhaDto, cartaoVazio: boolean): SituacaoDoDiaNoDocumento {
  const semBatida = dia.batidas.length === 0 && dia.extra === null;
  if (dia.abono && semBatida && dia.diaDeTrabalho) return "Abono";
  if (dia.diaDeTrabalho && dia.apuracao.faltas > 0 && !cartaoVazio) return "Falta";
  if (dia.feriado) return "Feriado";
  return dia.cargaMin === 0 ? "Folga" : "";
}

function linhaDoDia(dia: DiaDaFolhaDto, cartaoVazio: boolean): LinhaDoDocumentoDto {
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
    situacao: situacaoDoDia(dia, cartaoVazio),
  };
}

function itensDaTotalizacao(cartao: Cartao, cartaoVazio: boolean): ItemDoDocumentoDto[] {
  const totalizacao = cartao.totalizacao;
  const trabalhado = cartao.dias.reduce((soma, dia) => soma + dia.trabalhadoMin, 0);
  const extras = totalizacao.extras.length
    ? totalizacao.extras.map((faixa) => ({
        rotulo: `Extras ${faixa.percentual}%`,
        valor: duracaoEmHorasEMinutos(faixa.minutos),
      }))
    : [{ rotulo: "Horas extras", valor: duracaoEmHorasEMinutos(0) }];
  return [
    { rotulo: "Horas trabalhadas", valor: duracaoEmHorasEMinutos(trabalhado) },
    { rotulo: "Horas normais", valor: duracaoEmHorasEMinutos(totalizacao.normaisMin) },
    ...extras,
    ...(totalizacao.bancoDeHorasMin > 0
      ? [{ rotulo: "Banco de horas", valor: duracaoEmHorasEMinutos(totalizacao.bancoDeHorasMin) }]
      : []),
    ...(totalizacao.acimaDoLimiteMin > 0
      ? [
          {
            rotulo: "Extras acima do limite diário",
            valor: duracaoEmHorasEMinutos(totalizacao.acimaDoLimiteMin),
          },
        ]
      : []),
    { rotulo: "Adicional noturno", valor: duracaoEmHorasEMinutos(totalizacao.noturnoMin) },
    { rotulo: "Atrasos", valor: duracaoEmHorasEMinutos(totalizacao.atrasoMin) },
    { rotulo: "Faltas", valor: quantidadeDeDias(cartaoVazio ? 0 : totalizacao.faltas) },
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
  const cartaoVazio = !cartao.iniciado && !cartao.dias.some(temDados);
  const [ano, mes] = folha.competencia.split("-");
  return {
    empresa: folha.empresa,
    empregado: cartao.empregado.nome,
    periodo: `${mes}/${ano}`,
    linhas: cartao.dias.map((dia) => linhaDoDia(dia, cartaoVazio)),
    totalizacao: itensDaTotalizacao(cartao, cartaoVazio),
    avisoDaTotalizacao: cartao.semConvencao ? AVISO_SEM_CONVENCAO_NO_PDF : undefined,
  };
}
