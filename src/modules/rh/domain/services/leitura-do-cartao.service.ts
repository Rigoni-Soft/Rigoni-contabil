import {
  diaDaSemana,
  ehDiaDeTrabalho,
  type Jornada,
  type Par,
} from "@/modules/rh/domain/services/totalizacao.service";
import { validarPares } from "@/modules/rh/domain/services/validar-ponto.service";
import { Competencia } from "@/modules/rh/domain/value-objects/competencia.vo";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { TEXTO_CURTO_MAXIMO } from "@/shared/kernel/texto";

type DiaLido = {
  dia: number;
  batidas: Par[];
  extra: Par | null;
  atestado: boolean;
  faltou: boolean;
};
export type LeituraDoCartao = { nome: string | null; dias: DiaLido[] };
export type Quinzena = 1 | 2;

export type DiaDaLeitura = { data: string; batidas: Par[]; extra: Par | null; abono: boolean };
export type LeituraValida = { nome: string; dias: DiaDaLeitura[]; faltas: string[] };

export function diasAGravar(
  lidos: DiaDaLeitura[],
  jornada: Jornada,
  feriados: ReadonlySet<string>,
  datasComDado: ReadonlySet<string>,
): { gravar: DiaDaLeitura[]; mantidos: number } {
  const gravar: DiaDaLeitura[] = [];
  let mantidos = 0;
  for (const dia of lidos) {
    const soAbono = dia.abono && dia.batidas.length === 0 && !dia.extra;
    if (soAbono && !ehDiaDeTrabalho(jornada[diaDaSemana(dia.data)], feriados.has(dia.data)))
      continue;
    if (datasComDado.has(dia.data)) mantidos += 1;
    else gravar.push(dia);
  }
  return { gravar, mantidos };
}

const NOME = /^[\p{L}][\p{L} .'-]*$/u;
const MAXIMO_DE_HORAS_NO_DIA = 16;
const MAXIMO_DO_DIA_MIN = MAXIMO_DE_HORAS_NO_DIA * 60;
const MAXIMO_DE_BATIDAS_NO_DIA = 4;
const MAXIMO_DE_EXTRA_NO_DIA = 1;
const PASSO_DA_JORNADA_EM_MIN = 5;

export function nomeLegivel(lido: string | null): string | null {
  const nome = lido?.trim().replace(/\s+/g, " ") ?? "";
  return nome.length < 2 || nome.length > TEXTO_CURTO_MAXIMO || !NOME.test(nome) ? null : nome;
}

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

  const mes = Competencia.criar(alvo.competencia);
  if (!mes.ok) return recusa("Competência inválida.");

  const nome = nomeLegivel(leitura.nome);
  if (!nome) return recusa("Nome do empregado ilegível.");

  const ultimo = mes.value.dias.length;
  const [de, ate] = alvo.quinzena === 1 ? [1, 15] : [16, ultimo];
  const vistos = new Set<number>();
  const dias: DiaDaLeitura[] = [];
  const faltas: string[] = [];

  for (const diaLido of leitura.dias) {
    if (
      !Number.isInteger(diaLido.dia) ||
      diaLido.dia < de ||
      diaLido.dia > ate ||
      vistos.has(diaLido.dia)
    ) {
      return recusa(`Dia ${diaLido.dia} fora da quinzena ou repetido.`);
    }
    vistos.add(diaLido.dia);
    const batidas = validarPares(diaLido.batidas, MAXIMO_DE_BATIDAS_NO_DIA);
    const extra = validarPares(diaLido.extra ? [diaLido.extra] : [], MAXIMO_DE_EXTRA_NO_DIA);
    if (!batidas.ok || !extra.ok) return recusa(`Horário inválido no dia ${diaLido.dia}.`);
    if (!emOrdem(batidas.value, extra.value[0] ?? null)) {
      return recusa(`Horários fora de ordem no dia ${diaLido.dia}.`);
    }
    if (trabalhado(batidas.value) > MAXIMO_DO_DIA_MIN) {
      return recusa(`Mais de ${MAXIMO_DE_HORAS_NO_DIA} horas no dia ${diaLido.dia}.`);
    }
    const data = `${alvo.competencia}-${String(diaLido.dia).padStart(2, "0")}`;
    if (diaLido.faltou && batidas.value.length === 0) faltas.push(data);
    if (batidas.value.length === 0 && !extra.value[0] && !diaLido.atestado) continue;
    dias.push({
      data,
      batidas: batidas.value,
      extra: extra.value[0] ?? null,
      abono: diaLido.atestado,
    });
  }

  if (!dias.some((d) => d.batidas.length > 0 || d.extra)) return recusa("Nenhum horário lido.");
  return ok({ nome, dias, faltas });
}

export function deduzirJornada(dias: DiaDaLeitura[]): Jornada {
  const porDia: number[][] = [[], [], [], [], [], [], []];
  for (const dia of dias) {
    const min = trabalhado(dia.batidas);
    if (min <= 0) continue;
    porDia[diaDaSemana(dia.data)].push(min);
  }
  const mediana = (valores: number[]) => {
    if (valores.length === 0) return 0;
    const ordenados = [...valores].sort((a, b) => a - b);
    const meio = ordenados[Math.floor(ordenados.length / 2)];
    return Math.round(meio / PASSO_DA_JORNADA_EM_MIN) * PASSO_DA_JORNADA_EM_MIN;
  };
  return porDia.map(mediana) as unknown as Jornada;
}

type AcharEmpregado = { tipo: "um"; id: string } | { tipo: "nenhum" } | { tipo: "varios" };

const palavras = (nome: string) =>
  nome
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

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
