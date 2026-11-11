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

const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
// Jornada gravada nos empregados novos (a tela não a pede): o padrão do comércio, 8h45 de segunda a sexta e 4h no sábado, em minutos.
// ponytail: valor fixo até a Totalização deduzir a jornada da convenção/legislação (ticket a abrir).
export const JORNADA_PADRAO = [0, 525, 525, 525, 525, 525, 240];

export function minutosParaHm(minutos: number): string {
  return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
}

// "HH:MM" → minutos; vazio ou fora do formato = null.
export function hmParaMinutos(texto: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(texto);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

// 525 → "8h45"; 0 → "0h00".
function duracao(minutos: number): string {
  return `${Math.floor(minutos / 60)}h${String(minutos % 60).padStart(2, "0")}`;
}

const dias = (n: number) => `${n} ${n === 1 ? "dia" : "dias"}`;

export const AVISO_SEM_CONVENCAO =
  "Sem convenção coletiva vigente em parte do mês: esses dias foram totalizados pela legislação.";

export function itensDaTotalizacao(t: TotalizacaoDto, trabalhadoMin: number): ItemDaTotalizacao[] {
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
    { rotulo: "Faltas", valor: dias(t.faltas) },
    { rotulo: "Abonos", valor: `${dias(t.abonoDias)} · ${duracao(t.abonoMin)}` },
    { rotulo: "Feriados trabalhados", valor: String(t.feriadosTrabalhados) },
    { rotulo: "Sábados trabalhados", valor: String(t.sabadosTrabalhados) },
    { rotulo: "Dias com lanche", valor: String(t.diasComLanche) },
  ];
}

const hm = (par: ParDto | undefined, campo: keyof ParDto) => (par ? minutosParaHm(par[campo]) : "");

const teveExtra = (dia: DiaDaFolhaDto) => extrasDoDia(dia.apuracao) > 0;
export const temDados = (dia: DiaDoPontoDto) =>
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

// Cartão sem nenhum dado salvo (mês novo ou empregado novo): a tela abre com as linhas já editáveis.
export const cartaoSemDados = (dias: DiaDoPontoDto[]) => !dias.some(temDados);

export function linhasDoCartao(dias: DiaDaFolhaDto[]): LinhaDoCartao[] {
  const vazio = cartaoSemDados(dias);
  return dias.map((dia) => {
    const situacao = situacaoDoDia(dia, vazio);
    const [, mes, d] = dia.data.split("-");
    return {
      data: dia.data,
      rotulo: `${SEMANA[dia.diaDaSemana]} ${d}/${mes}`,
      entrada1: hm(dia.batidas[0], "entrada"),
      saida1: hm(dia.batidas[0], "saida"),
      entrada2: hm(dia.batidas[1], "entrada"),
      saida2: hm(dia.batidas[1], "saida"),
      extraEntrada: hm(dia.extra ?? undefined, "entrada"),
      extraSaida: hm(dia.extra ?? undefined, "saida"),
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
  const q = new URLSearchParams();
  for (const [chave, valor] of Object.entries(parametros)) if (valor) q.set(chave, String(valor));
  const texto = q.toString();
  return texto ? `?${texto}` : "";
}

export function hrefDaFolha(clienteId: string, { mes, empregado }: Pedido): string {
  return `/rh/folha-de-ponto/${encodeURIComponent(clienteId)}${busca({ mes, empregado })}`;
}

// O Cartão de ponto de um empregado tem tela própria: o quadro cadastra, o cartão digita.
export function hrefDoCartao(
  clienteId: string,
  empregadoId: string,
  { mes }: Pick<Pedido, "mes">,
): string {
  return `/rh/folha-de-ponto/${encodeURIComponent(clienteId)}/cartao/${encodeURIComponent(empregadoId)}${busca({ mes })}`;
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
    selecionado: e.id === folha.selecionado?.empregado.id,
    selos: selos(e),
  }));
}

// O empregado escolhido pode ser inativo (ativo falso): o quadro o lista e deixa reativar.
export function empregadoEmEdicao(folha: FolhaDePontoDto): EmpregadoEmEdicao | undefined {
  const e = folha.selecionado?.empregado;
  return (
    e && {
      id: e.id,
      nome: e.nome,
      comissionado: e.comissionado,
      ativo: e.ativo,
      semMovimento: e.semMovimento,
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
  const e = texto(c, entrada);
  const s = texto(c, saida);
  if (!e && !s) return null;
  const [em, sm] = [hmParaMinutos(e), hmParaMinutos(s)];
  if (em === null || sm === null || em === sm) return "incompleto";
  return { entrada: em, saida: sm };
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
