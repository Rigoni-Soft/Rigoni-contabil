// A leitura da foto do Cartão de ponto (visão) chega aqui ainda não confiável: o domínio a valida e
// só o que passa vira dado. Leitura reprovada = digitação manual.
import {
  diaDaSemana,
  type Jornada,
  type Par,
} from "@/modules/rh/domain/services/totalizacao.service";
import { validarPares } from "@/modules/rh/domain/services/validar-ponto.service";
import { Competencia } from "@/modules/rh/domain/value-objects/competencia.vo";
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

type DiaDaLeitura = { data: string; batidas: Par[]; extra: Par | null; abono: boolean };
export type LeituraValida = { nome: string; dias: DiaDaLeitura[]; faltas: string[] };

const NOME = /^[\p{L}][\p{L} .'-]*$/u;
const MAXIMO_DO_DIA_MIN = 16 * 60;

// Nome do empregado como lido (cartão ou atestado): espaços normalizados; null se ilegível.
export function nomeLegivel(lido: string | null): string | null {
  const nome = lido?.trim().replace(/\s+/g, " ") ?? "";
  return nome.length < 2 || nome.length > TEXTO_CURTO_MAXIMO || !NOME.test(nome) ? null : nome;
}

// Os horários do dia, na ordem do cartão (manhã, tarde, extra), crescem: o modelo que troca um dígito
// quase sempre quebra isso. ponytail: turno que vira a noite reprova e cai na digitação; aceitar a virada quando houver cartão assim.
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
    const batidas = validarPares(diaLido.batidas, 4);
    const extra = validarPares(diaLido.extra ? [diaLido.extra] : [], 1);
    if (!batidas.ok || !extra.ok) return recusa(`Horário inválido no dia ${diaLido.dia}.`);
    if (!emOrdem(batidas.value, extra.value[0] ?? null)) {
      return recusa(`Horários fora de ordem no dia ${diaLido.dia}.`);
    }
    if (trabalhado(batidas.value) > MAXIMO_DO_DIA_MIN) {
      return recusa(`Mais de 16 horas no dia ${diaLido.dia}.`);
    }
    const data = `${alvo.competencia}-${String(diaLido.dia).padStart(2, "0")}`;
    if (diaLido.faltou && batidas.value.length === 0) faltas.push(data);
    // Linha em branco não vira dia: não apaga o que já está digitado.
    if (batidas.value.length === 0 && !extra.value[0] && !diaLido.atestado) continue;
    dias.push({
      data,
      batidas: batidas.value,
      extra: extra.value[0] ?? null,
      abono: diaLido.atestado,
    });
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
  for (const dia of dias) {
    const min = trabalhado(dia.batidas);
    if (min <= 0) continue;
    porDia[diaDaSemana(dia.data)].push(min);
  }
  const mediana = (valores: number[]) => {
    if (valores.length === 0) return 0;
    const ordenados = [...valores].sort((a, b) => a - b);
    const meio = ordenados[Math.floor(ordenados.length / 2)];
    return Math.round(meio / 5) * 5;
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
