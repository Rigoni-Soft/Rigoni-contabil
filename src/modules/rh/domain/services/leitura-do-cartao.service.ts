// A leitura da foto do Cartão de ponto (OCR ou visão) chega aqui ainda não confiável: o domínio a valida e
// só o que passa vira dado. Leitura reprovada = o leitor seguinte tenta; todos reprovados = digitação manual.
import type { Jornada, Par } from "@/modules/rh/domain/services/totalizacao.service";
import { validarPares } from "@/modules/rh/domain/services/validar-ponto.service";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { TEXTO_CURTO_MAXIMO } from "@/shared/kernel/texto";

export type DiaLido = {
  // Dia do mês impresso na linha do cartão.
  dia: number;
  batidas: Par[];
  extra: Par | null;
  // Anotação "atestado" no dia.
  atestado: boolean;
  // Anotação "faltou" no dia.
  faltou: boolean;
};
export type LeituraDoCartao = { nome: string | null; dias: DiaLido[] };
export type Quinzena = 1 | 2;

export type DiaDaLeitura = { data: string; batidas: Par[]; extra: Par | null; abono: boolean };
export type LeituraValida = { nome: string; dias: DiaDaLeitura[]; faltas: string[] };

const NOME = /^[\p{L}][\p{L} .'-]*$/u;
const MAXIMO_DO_DIA_MIN = 16 * 60;

function ultimoDiaDoMes(competencia: string): number {
  const [ano, mes] = competencia.split("-").map(Number);
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

// Os horários do dia, na ordem do cartão (manhã, tarde, extra), crescem: o OCR que troca um dígito quase
// sempre quebra isso. ponytail: turno que vira a noite reprova e cai na digitação; aceitar a virada quando houver cartão assim.
function emOrdem(batidas: Par[], extra: Par | null): boolean {
  const marcas = [...batidas, ...(extra ? [extra] : [])].flatMap((p) => [p.entrada, p.saida]);
  return marcas.every((m, i) => i === 0 || m > marcas[i - 1]);
}

function trabalhado(batidas: Par[]): number {
  return batidas.reduce((total, p) => total + (p.saida - p.entrada), 0);
}

export function validarLeitura(
  leitura: LeituraDoCartao,
  alvo: { competencia: string; quinzena: Quinzena },
): Result<LeituraValida, ValidationError> {
  const recusa = (motivo: string) => err(new ValidationError(motivo, { leitura: [motivo] }));

  const nome = leitura.nome?.trim().replace(/\s+/g, " ") ?? "";
  if (nome.length < 2 || nome.length > TEXTO_CURTO_MAXIMO || !NOME.test(nome)) {
    return recusa("Nome do empregado ilegível.");
  }

  const ultimo = ultimoDiaDoMes(alvo.competencia);
  const [de, ate] = alvo.quinzena === 1 ? [1, 15] : [16, ultimo];
  const vistos = new Set<number>();
  const dias: DiaDaLeitura[] = [];
  const faltas: string[] = [];

  for (const d of leitura.dias) {
    if (!Number.isInteger(d.dia) || d.dia < de || d.dia > ate || vistos.has(d.dia)) {
      return recusa(`Dia ${d.dia} fora da quinzena ou repetido.`);
    }
    vistos.add(d.dia);
    const batidas = validarPares(d.batidas, 4);
    const extra = validarPares(d.extra ? [d.extra] : [], 1);
    if (!batidas.ok || !extra.ok) return recusa(`Horário inválido no dia ${d.dia}.`);
    if (!emOrdem(batidas.value, extra.value[0] ?? null)) {
      return recusa(`Horários fora de ordem no dia ${d.dia}.`);
    }
    if (trabalhado(batidas.value) > MAXIMO_DO_DIA_MIN) {
      return recusa(`Mais de 16 horas no dia ${d.dia}.`);
    }
    const data = `${alvo.competencia}-${String(d.dia).padStart(2, "0")}`;
    if (d.faltou && batidas.value.length === 0) faltas.push(data);
    // Linha em branco não vira dia: não apaga o que já está digitado.
    if (batidas.value.length === 0 && !extra.value[0] && !d.atestado) continue;
    dias.push({ data, batidas: batidas.value, extra: extra.value[0] ?? null, abono: d.atestado });
  }

  // Cartão sem nenhuma batida lida é leitura que não leu nada.
  if (!dias.some((d) => d.batidas.length > 0 || d.extra)) return recusa("Nenhum horário lido.");
  return ok({ nome, dias, faltas });
}

// Jornada pelo padrão das batidas: a mediana do trabalhado em cada dia da semana (domingo = 0), em
// múltiplos de 5 min; dia da semana sem batida na quinzena = não trabalha. ponytail: uma quinzena dá 2
// amostras por dia da semana; o Funcionário corrige a Jornada no quadro se o padrão errar.
export function deduzirJornada(dias: DiaDaLeitura[]): Jornada {
  const porDia: number[][] = [[], [], [], [], [], [], []];
  for (const d of dias) {
    const min = trabalhado(d.batidas);
    if (min <= 0) continue;
    const [ano, mes, dia] = d.data.split("-").map(Number);
    porDia[new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay()].push(min);
  }
  const mediana = (v: number[]) => {
    if (v.length === 0) return 0;
    const o = [...v].sort((a, b) => a - b);
    const m = o[Math.floor(o.length / 2)];
    return Math.round(m / 5) * 5;
  };
  return porDia.map(mediana) as unknown as Jornada;
}

export type AcharEmpregado = { tipo: "um"; id: string } | { tipo: "nenhum" } | { tipo: "varios" };

const palavras = (nome: string) =>
  nome
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

// O cartão costuma ter só o primeiro nome ("ERICK") e o quadro o nome inteiro: casa quando as palavras de
// um são o começo das do outro. Mais de um casado = não adivinha (o Funcionário digita).
export function acharEmpregadoPeloNome(
  nomeLido: string,
  empregados: { id: string; nome: string }[],
): AcharEmpregado {
  const lido = palavras(nomeLido);
  const comeca = (a: string[], b: string[]) => a.every((p, i) => b[i] === p);
  const casados = empregados.filter((e) => {
    const nome = palavras(e.nome);
    return comeca(lido, nome) || comeca(nome, lido);
  });
  if (casados.length === 1) return { tipo: "um", id: casados[0].id };
  return casados.length === 0 ? { tipo: "nenhum" } : { tipo: "varios" };
}
