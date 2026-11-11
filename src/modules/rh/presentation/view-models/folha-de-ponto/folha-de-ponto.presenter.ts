import type { LinhaDoCartao } from "@/presentation/components/molecules/linha-do-cartao-de-ponto.component";
import type { ItemDaTotalizacao } from "@/presentation/components/molecules/totalizacao-do-ponto.component";
import type {
  EmpregadoDoQuadro,
  EmpregadoEmEdicao,
} from "@/presentation/components/organisms/quadro-de-funcionarios.component";
import type {
  DiaDaFolhaDto,
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
  "Sem convenção coletiva vigente em parte da quinzena: esses dias foram totalizados pela legislação.";

export function itensDaTotalizacao(t: TotalizacaoDto): ItemDaTotalizacao[] {
  const extras = t.extras.length
    ? t.extras.map((e) => ({ rotulo: `Extras ${e.percentual}%`, valor: duracao(e.minutos) }))
    : [{ rotulo: "Horas extras", valor: duracao(0) }];
  return [
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

function notaDoDia(dia: DiaDaFolhaDto): string | undefined {
  if (dia.feriado) return "Feriado";
  return dia.cargaMin === 0 ? "Sem jornada" : undefined;
}

export function linhasDoCartao(dias: DiaDaFolhaDto[]): LinhaDoCartao[] {
  return dias.map((dia) => {
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
      nota: notaDoDia(dia),
    };
  });
}

type Pedido = { mes?: string; quinzena?: 1 | 2; empregado?: string };

export function hrefDaFolha(clienteId: string, { mes, quinzena, empregado }: Pedido): string {
  const busca = new URLSearchParams();
  if (mes) busca.set("mes", mes);
  if (quinzena) busca.set("quinzena", String(quinzena));
  if (empregado) busca.set("empregado", empregado);
  const texto = busca.toString();
  return `/rh/folha-de-ponto/${encodeURIComponent(clienteId)}${texto ? `?${texto}` : ""}`;
}

// O Cartão de ponto de um empregado tem tela própria: o quadro cadastra, o cartão digita.
export function hrefDoCartao(
  clienteId: string,
  empregadoId: string,
  { mes, quinzena }: Pick<Pedido, "mes" | "quinzena">,
): string {
  const busca = new URLSearchParams();
  if (mes) busca.set("mes", mes);
  if (quinzena) busca.set("quinzena", String(quinzena));
  const texto = busca.toString();
  return `/rh/folha-de-ponto/${encodeURIComponent(clienteId)}/cartao/${encodeURIComponent(empregadoId)}${texto ? `?${texto}` : ""}`;
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
      quinzena: folha.quinzena,
      empregado: e.id,
    }),
    cartaoHref: hrefDoCartao(folha.clienteId, e.id, {
      mes: folha.competencia,
      quinzena: folha.quinzena,
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
  const href = (p: Pick<Pedido, "mes" | "quinzena">) => hrefDoCartao(folha.clienteId, empregado, p);
  return {
    mesAnteriorHref: href({ mes: mesVizinho(folha.competencia, -1), quinzena: 1 }),
    proximoMesHref:
      folha.competencia < mesAtual()
        ? href({ mes: mesVizinho(folha.competencia, 1), quinzena: 1 })
        : undefined,
    quinzenas: ([1, 2] as const).map((q) => ({
      rotulo: q === 1 ? "1ª quinzena (1 a 15)" : "2ª quinzena (16 ao fim)",
      href: href({ mes: folha.competencia, quinzena: q }),
      atual: q === folha.quinzena,
    })),
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
