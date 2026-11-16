import type {
  DocumentoDoCartaoDto,
  ItemDoDocumentoDto,
  LinhaDoDocumentoDto,
} from "@/modules/rh/application/dtos/documento-do-cartao.dto";
import type {
  DiaDaFolhaDto,
  FolhaDePontoDto,
  ParDto,
} from "@/modules/rh/application/dtos/folha-de-ponto.dto";

type Cartao = NonNullable<FolhaDePontoDto["selecionado"]>;

const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
export const AVISO_SEM_CONVENCAO_NO_PDF =
  "Sem convenção coletiva vigente em parte do mês: esses dias foram totalizados pela legislação.";

const hm = (minutos: number) =>
  `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
// 525 → "8h45".
const duracao = (minutos: number) =>
  `${Math.floor(minutos / 60)}h${String(minutos % 60).padStart(2, "0")}`;
const dias = (n: number) => `${n} ${n === 1 ? "dia" : "dias"}`;
const horaDe = (par: ParDto | undefined, campo: keyof ParDto) => (par ? hm(par[campo]) : "");

const temDados = (dia: DiaDaFolhaDto) => dia.batidas.length > 0 || dia.extra !== null || dia.abono;

// Cartão ainda não iniciado e sem nenhum dado: os dias úteis vazios ainda não são falta (como na tela).
function situacaoDoDia(dia: DiaDaFolhaDto, cartaoVazio: boolean): string {
  const semBatida = dia.batidas.length === 0 && dia.extra === null;
  if (dia.abono && semBatida && dia.diaDeTrabalho) return "Abono";
  if (dia.diaDeTrabalho && dia.apuracao.faltas > 0 && !cartaoVazio) return "Falta";
  if (dia.feriado) return "Feriado";
  return dia.cargaMin === 0 ? "Folga" : "";
}

function linhaDoDia(dia: DiaDaFolhaDto, cartaoVazio: boolean): LinhaDoDocumentoDto {
  const [, mes, d] = dia.data.split("-");
  return {
    data: `${d}/${mes}`,
    diaDaSemana: SEMANA[dia.diaDaSemana],
    batidas: [
      horaDe(dia.batidas[0], "entrada"),
      horaDe(dia.batidas[0], "saida"),
      horaDe(dia.batidas[1], "entrada"),
      horaDe(dia.batidas[1], "saida"),
    ],
    extra: dia.extra ? `${hm(dia.extra.entrada)}-${hm(dia.extra.saida)}` : "",
    horasDiarias: duracao(dia.trabalhadoMin),
    situacao: situacaoDoDia(dia, cartaoVazio),
  };
}

function itensDaTotalizacao(cartao: Cartao, cartaoVazio: boolean): ItemDoDocumentoDto[] {
  const t = cartao.totalizacao;
  const trabalhado = cartao.dias.reduce((soma, d) => soma + d.trabalhadoMin, 0);
  const extras = t.extras.length
    ? t.extras.map((e) => ({ rotulo: `Extras ${e.percentual}%`, valor: duracao(e.minutos) }))
    : [{ rotulo: "Horas extras", valor: duracao(0) }];
  return [
    { rotulo: "Horas trabalhadas", valor: duracao(trabalhado) },
    { rotulo: "Horas normais", valor: duracao(t.normaisMin) },
    ...extras,
    ...(t.bancoDeHorasMin > 0
      ? [{ rotulo: "Banco de horas", valor: duracao(t.bancoDeHorasMin) }]
      : []),
    ...(t.acimaDoLimiteMin > 0
      ? [{ rotulo: "Extras acima do limite diário", valor: duracao(t.acimaDoLimiteMin) }]
      : []),
    { rotulo: "Adicional noturno", valor: duracao(t.noturnoMin) },
    { rotulo: "Atrasos", valor: duracao(t.atrasoMin) },
    { rotulo: "Faltas", valor: dias(cartaoVazio ? 0 : t.faltas) },
    { rotulo: "Abonos", valor: `${dias(t.abonoDias)} · ${duracao(t.abonoMin)}` },
    { rotulo: "Feriados trabalhados", valor: String(t.feriadosTrabalhados) },
    { rotulo: "Sábados trabalhados", valor: String(t.sabadosTrabalhados) },
    { rotulo: "Dias com lanche", valor: String(t.diasComLanche) },
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
