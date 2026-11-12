import type { LinhaDoCartao } from "@/presentation/components/molecules/linha-do-cartao-de-ponto.component";
import type { ItemDaTotalizacao } from "@/presentation/components/molecules/totalizacao-do-ponto.component";
import type {
  EmpregadoDoQuadro,
  EmpregadoEmEdicao,
} from "@/presentation/components/organisms/quadro-de-funcionarios.component";
import type {
  DiaDaFolhaDto,
  DiaDoPontoDto,
  EmpregadoDaFolhaDto,
  FolhaDePontoDto,
  ParDto,
  TotalizacaoDto,
} from "@/modules/rh/application/dtos/folha-de-ponto.dto";
import { mesAtual, mesVizinho } from "@/shared/kernel/mes-atual";
import { ROTA_RH_FOLHA_DE_PONTO } from "@/shared/kernel/setores";

const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
// Jornada gravada nos empregados novos (a tela não a pede): o padrão do comércio, 8h45 de segunda a sexta e
// 4h no sábado, em minutos.
// ponytail: valor fixo até a Totalização deduzir a jornada da convenção/legislação. TODO(#235)
export const JORNADA_PADRAO = [0, 525, 525, 525, 525, 525, 240];

export function minutosParaHm(minutos: number): string {
  return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
}

// "HH:MM" → minutos; vazio ou fora do formato = null.
export function hmParaMinutos(texto: string): number | null {
  const horario = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(texto);
  return horario ? Number(horario[1]) * 60 + Number(horario[2]) : null;
}

// 525 → "8h45"; 0 → "0h00".
function duracao(minutos: number): string {
  return `${Math.floor(minutos / 60)}h${String(minutos % 60).padStart(2, "0")}`;
}

const dias = (n: number) => `${n} ${n === 1 ? "dia" : "dias"}`;

export const AVISO_SEM_CONVENCAO =
  "Sem convenção coletiva vigente em parte do mês: esses dias foram totalizados pela legislação.";

// `semDados`: cartão ainda não começado (mês ou empregado novo): as linhas aparecem neutras e a Totalização não conta
// os dias úteis vazios como falta (eles só viram falta depois que o cartão é começado).
export function itensDaTotalizacao(
  t: TotalizacaoDto,
  trabalhadoMin: number,
  semDados = false,
): ItemDaTotalizacao[] {
  const extras = t.extras.length
    ? t.extras.map((e) => ({ rotulo: `Extras ${e.percentual}%`, valor: duracao(e.minutos) }))
    : [{ rotulo: "Horas extras", valor: duracao(0) }];
  return [
    { rotulo: "Horas trabalhadas", valor: duracao(trabalhadoMin) },
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
    { rotulo: "Faltas", valor: dias(semDados ? 0 : t.faltas) },
    { rotulo: "Abonos", valor: `${dias(t.abonoDias)} · ${duracao(t.abonoMin)}` },
    { rotulo: "Feriados trabalhados", valor: String(t.feriadosTrabalhados) },
    { rotulo: "Sábados trabalhados", valor: String(t.sabadosTrabalhados) },
    { rotulo: "Dias com lanche", valor: String(t.diasComLanche) },
  ];
}

const horaDoPar = (par: ParDto | undefined, campo: keyof ParDto) =>
  par ? minutosParaHm(par[campo]) : "";

const teveExtra = (dia: DiaDaFolhaDto) => extrasDoDia(dia.apuracao) > 0;
export const temDados = (dia: Pick<DiaDoPontoDto, "batidas" | "extra" | "abono">) =>
  dia.batidas.length > 0 || dia.extra !== null || dia.abono;
const semBatida = (dia: DiaDoPontoDto) => dia.batidas.length === 0 && dia.extra === null;

// A situação do dia, que decide o que a linha deixa digitar e qual botão ela mostra:
// abonado (travado; "Desfazer abono"), falta (dia útil vazio de um cartão já começado; travado até o lápis),
// folga (sem jornada ou feriado: só a coluna Extra), em branco (dia útil vazio de um cartão ainda sem nenhum
// dado: neutro e já editável) e normal.
function situacaoDoDia(dia: DiaDaFolhaDto, cartaoVazio: boolean): LinhaDoCartao["situacao"] {
  if (dia.abono && semBatida(dia)) return "abonado";
  if (dia.feriado || dia.cargaMin === 0) return "folga";
  if (dia.apuracao.faltas > 0) return cartaoVazio ? "branco" : "falta";
  return "normal";
}

// Texto do estado do dia sob a data (a cor da linha nunca vai sozinha).
function notaDoDia(dia: DiaDaFolhaDto, situacao: LinhaDoCartao["situacao"]): string | undefined {
  const base = dia.feriado ? "Feriado" : dia.cargaMin === 0 ? "Folga" : undefined;
  if (situacao === "falta") return "Falta";
  if (situacao === "abonado") return "Abonado";
  if (teveExtra(dia)) return base ? `${base} · hora extra` : "Hora extra";
  return base;
}

// O tom da linha: falta em vermelho suave, hora extra em azul, folga ou feriado em amarelo, dia normal sem tom.
function tomDoDia(dia: DiaDaFolhaDto, situacao: LinhaDoCartao["situacao"]): LinhaDoCartao["tom"] {
  if (situacao === "falta") return "alerta";
  if (teveExtra(dia)) return "info";
  return situacao === "folga" ? "atencao" : undefined;
}

// Faixas de hora extra do dia, da menor para a maior: "1h11 (50%)". A planilha tem 1ª e 2ª faixa.
const faixaDe = (e?: { percentual: number; minutos: number }) =>
  e ? `${duracao(e.minutos)} (${e.percentual}%)` : "";

const extrasDoDia = (a: TotalizacaoDto) =>
  a.extras.reduce((soma, e) => soma + e.minutos, 0) + a.bancoDeHorasMin;

// Cartão novo (mês ou empregado novo; a tela abre com as linhas já editáveis): nunca salvo (sem a marca de iniciado) e sem nenhum dado.
export const cartaoSemDados = (dias: DiaDoPontoDto[], iniciado: boolean) =>
  !iniciado && !dias.some(temDados);

export function linhasDoCartao(dias: DiaDaFolhaDto[], iniciado: boolean): LinhaDoCartao[] {
  const vazio = cartaoSemDados(dias, iniciado);
  return dias.map((dia) => {
    const situacao = situacaoDoDia(dia, vazio);
    const [, mes, d] = dia.data.split("-");
    return {
      data: dia.data,
      rotulo: `${SEMANA[dia.diaDaSemana]} ${d}/${mes}`,
      entrada1: horaDoPar(dia.batidas[0], "entrada"),
      saida1: horaDoPar(dia.batidas[0], "saida"),
      entrada2: horaDoPar(dia.batidas[1], "entrada"),
      saida2: horaDoPar(dia.batidas[1], "saida"),
      extraEntrada: horaDoPar(dia.extra ?? undefined, "entrada"),
      extraSaida: horaDoPar(dia.extra ?? undefined, "saida"),
      abono: dia.abono,
      nota: notaDoDia(dia, situacao),
      tom: tomDoDia(dia, situacao),
      situacao,
      diaSemana: SEMANA[dia.diaDaSemana],
      diaMes: `${d}/${mes}`,
      trabalhado: duracao(dia.trabalhadoMin),
      atraso: duracao(dia.apuracao.atrasoMin),
      extras: duracao(extrasDoDia(dia.apuracao)),
      faixa1: faixaDe(dia.apuracao.extras[0]),
      faixa2: faixaDe(dia.apuracao.extras[1]),
      noturno: duracao(dia.apuracao.noturnoMin),
    };
  });
}

type Pedido = { mes?: string; empregado?: string };

// "?mes=…&empregado=…" só com o que foi pedido.
function busca(parametros: Record<string, string | number | undefined>): string {
  const consulta = new URLSearchParams();
  for (const [chave, valor] of Object.entries(parametros))
    if (valor) consulta.set(chave, String(valor));
  const texto = consulta.toString();
  return texto ? `?${texto}` : "";
}

export function hrefDaFolha(clienteId: string, { mes, empregado }: Pedido): string {
  return `${ROTA_RH_FOLHA_DE_PONTO}/${encodeURIComponent(clienteId)}${busca({ mes, empregado })}`;
}

// O Cartão de ponto de um empregado tem tela própria: o quadro cadastra, o cartão digita.
export function hrefDoCartao(
  clienteId: string,
  empregadoId: string,
  { mes }: Pick<Pedido, "mes">,
): string {
  return `${ROTA_RH_FOLHA_DE_PONTO}/${encodeURIComponent(clienteId)}/cartao/${encodeURIComponent(empregadoId)}${busca({ mes })}`;
}

function selos(e: EmpregadoDaFolhaDto): string[] {
  return [
    !e.ativo && "desligado",
    e.ativo && e.semMovimento && "sem movimento no mês",
    e.comissionado && "comissionado",
  ].filter((s): s is string => !!s);
}

export function quadroDoEmpregado(folha: FolhaDePontoDto): EmpregadoDoQuadro[] {
  return folha.empregados.map((e) => ({
    id: e.id,
    nome: e.nome,
    href: hrefDaFolha(folha.clienteId, {
      mes: folha.competencia,
      empregado: e.id,
    }),
    cartaoHref: hrefDoCartao(folha.clienteId, e.id, {
      mes: folha.competencia,
    }),
    ativo: e.ativo,
    selecionado: e.id === folha.selecionado?.empregado.id,
    selos: selos(e),
  }));
}

// O empregado escolhido pode ser inativo (ativo falso): o quadro o lista e deixa reativar.
export function empregadoEmEdicao(folha: FolhaDePontoDto): EmpregadoEmEdicao | undefined {
  const empregado = folha.selecionado?.empregado;
  return (
    empregado && {
      id: empregado.id,
      nome: empregado.nome,
      comissionado: empregado.comissionado,
      ativo: empregado.ativo,
      semMovimento: empregado.semMovimento,
    }
  );
}

export function navegacaoDoCartao(folha: FolhaDePontoDto) {
  const empregado = folha.selecionado?.empregado.id ?? "";
  const href = (mes: string) => hrefDoCartao(folha.clienteId, empregado, { mes });
  return {
    mesAnteriorHref: href(mesVizinho(folha.competencia, -1)),
    proximoMesHref:
      folha.competencia < mesAtual() ? href(mesVizinho(folha.competencia, 1)) : undefined,
  };
}

type Campos = { get(nome: string): FormDataEntryValue | null };
const texto = (c: Campos, nome: string) => String(c.get(nome) ?? "").trim();

export type DiaLido =
  | { ok: true; batidas: ParDto[]; extra: ParDto | null; abono: boolean }
  | { ok: false; erro: string };

// Entrada e saída vêm juntas: um par pela metade é erro do formulário, não um horário perdido.
function par(c: Campos, entrada: string, saida: string): ParDto | null | "incompleto" {
  const horaDeEntrada = texto(c, entrada);
  const horaDeSaida = texto(c, saida);
  if (!horaDeEntrada && !horaDeSaida) return null;
  const entradaEmMinutos = hmParaMinutos(horaDeEntrada);
  const saidaEmMinutos = hmParaMinutos(horaDeSaida);
  if (entradaEmMinutos === null || saidaEmMinutos === null || entradaEmMinutos === saidaEmMinutos)
    return "incompleto";
  return { entrada: entradaEmMinutos, saida: saidaEmMinutos };
}

export function lerDiaDoFormulario(c: Campos): DiaLido {
  const pares = [par(c, "entrada1", "saida1"), par(c, "entrada2", "saida2")];
  const extra = par(c, "extraEntrada", "extraSaida");
  if ([...pares, extra].includes("incompleto")) {
    return { ok: false, erro: "Preencha entrada e saída (horários diferentes) de cada par." };
  }
  return {
    ok: true,
    batidas: pares.filter((p): p is ParDto => p !== null && p !== "incompleto"),
    extra: extra === "incompleto" ? null : extra,
    abono: c.get("abono") !== null,
  };
}

export function lerEmpregadoDoFormulario(c: Campos) {
  return { nome: texto(c, "nome"), comissionado: c.get("comissionado") !== null };
}
