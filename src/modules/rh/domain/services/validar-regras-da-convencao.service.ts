import {
  CHAVES_DE_REGRA,
  CHAVES_NUMERICAS,
  REFERENCIA_DA_LEGISLACAO,
  VERSAO_DO_ESQUEMA,
  type ChaveDeRegra,
  type ChaveNumerica,
  type DataEspecial,
  type ExcecaoDeFeriado,
  type MotivoDeRejeicao,
  type RegraAplicada,
  type RegraRejeitada,
  type RegrasDaConvencao,
} from "@/shared/kernel/regras-da-convencao";
import { TEXTO_CURTO_MAXIMO } from "@/shared/kernel/texto";

// O que o modelo de linguagem devolve: tudo não confiável até passar por aqui.
export type RegraCandidata = {
  chave: string;
  valor: unknown;
  clausula: string;
  trecho: string;
};

const MAXIMO_TRECHO = 2000;
const MAXIMO_PERCENTUAL = 300;
const MINUTOS_NA_SEMANA = 7 * 1440;

// A decisão é determinística e sem o modelo: cada parâmetro precisa citar a cláusula, trazer o número no
// trecho citado e respeitar o piso da legislação; o resto é rejeitado e fica "não aplicada" (vale a lei).
export function validarRegrasDaConvencao(candidatas: RegraCandidata[]): RegrasDaConvencao {
  const aplicadas: RegraAplicada[] = [];
  const rejeitadas: RegraRejeitada[] = [];
  const vistas = new Set<string>();

  for (const candidata of candidatas) {
    const motivo = vistas.has(candidata.chave) ? "duplicada" : avaliar(candidata);
    if (typeof motivo === "string") {
      rejeitadas.push({ chave: candidata.chave, motivo });
      continue;
    }
    vistas.add(candidata.chave);
    aplicadas.push(motivo);
  }
  return { versao: VERSAO_DO_ESQUEMA, aplicadas, rejeitadas };
}

function avaliar(candidata: RegraCandidata): MotivoDeRejeicao | RegraAplicada {
  const { chave, clausula, trecho } = candidata;
  if (!ehChave(chave)) return "chave_desconhecida";

  const clausulaLimpa = clausula.trim();
  const trechoLimpo = trecho.trim();
  if (
    clausulaLimpa === "" ||
    trechoLimpo === "" ||
    clausulaLimpa.length > TEXTO_CURTO_MAXIMO ||
    trechoLimpo.length > MAXIMO_TRECHO
  ) {
    return "sem_citacao";
  }
  const citacao = { clausula: clausulaLimpa, trecho: trechoLimpo };

  if (ehNumerica(chave)) {
    const { valor } = candidata;
    if (!numeroValido(chave, valor)) return "valor_invalido";
    const unidade = REFERENCIA_DA_LEGISLACAO[chave].unidade;
    const aparece =
      unidade === "minutos"
        ? tempoNoTrecho(valor, trechoLimpo)
        : numerosDe(trechoLimpo).includes(valor);
    if (!aparece) return "fora_do_trecho";
    const piso = REFERENCIA_DA_LEGISLACAO[chave].piso;
    if (piso !== undefined && valor < piso) return "abaixo_da_legislacao";
    return { chave, valor, ...citacao };
  }

  if (chave === "datas_especiais") {
    const datas = datasEspeciais(candidata.valor);
    if (!datas) return "valor_invalido";
    const numeros = numerosDe(trechoLimpo);
    const noTrecho = datas.every(
      (d) =>
        numeros.includes(d.percentual) &&
        (d.percentualComissionado === undefined || numeros.includes(d.percentualComissionado)) &&
        (d.data === null || dataNoTrecho(d.data, trechoLimpo)),
    );
    if (!noTrecho) return "fora_do_trecho";
    const piso = REFERENCIA_DA_LEGISLACAO.datas_especiais.piso ?? 0;
    if (datas.some((d) => d.percentual < piso)) return "abaixo_da_legislacao";
    return { chave, valor: datas, ...citacao };
  }

  const excecoes = excecoesDeFeriado(candidata.valor);
  if (!excecoes) return "valor_invalido";
  const texto = semAcento(trechoLimpo);
  if (!excecoes.every((e) => texto.includes(semAcento(e.descricao)))) return "fora_do_trecho";
  return { chave, valor: excecoes, ...citacao };
}

function ehChave(chave: string): chave is ChaveDeRegra {
  return (CHAVES_DE_REGRA as readonly string[]).includes(chave);
}

function ehNumerica(chave: ChaveDeRegra): chave is ChaveNumerica {
  return (CHAVES_NUMERICAS as readonly string[]).includes(chave);
}

function numeroValido(chave: ChaveNumerica, valor: unknown): valor is number {
  if (typeof valor !== "number" || !Number.isFinite(valor) || valor <= 0) return false;
  if (REFERENCIA_DA_LEGISLACAO[chave].unidade === "percentual") return valor <= MAXIMO_PERCENTUAL;
  const maximo = chave === "jornada_semanal" ? MINUTOS_NA_SEMANA : 1440;
  return Number.isInteger(valor) && valor <= maximo;
}

// Os números escritos no trecho, com vírgula ou ponto decimal ("55,5" vale 55.5).
function numerosDe(trecho: string): number[] {
  return (trecho.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => Number(n.replace(",", ".")));
}

// Tempo em minutos confere se o trecho traz os minutos, as horas cheias ("2 horas", "08:00") ou o par
// hora e minuto ("7h20"). Tempo por extenso ("duas horas") não confere: a regra cai em "não aplicada".
function tempoNoTrecho(minutos: number, trecho: string): boolean {
  const numeros = numerosDe(trecho);
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return (
    numeros.includes(minutos) ||
    (resto === 0 && numeros.includes(horas)) ||
    (numeros.includes(horas) && numeros.includes(resto))
  );
}

function dataValida(data: string): boolean {
  const m = /^(\d{2})\/(\d{2})$/.exec(data);
  if (!m) return false;
  const dia = Number(m[1]);
  const mes = Number(m[2]);
  // 2024 é bissexto: 29/02 existe como data fixa de calendário.
  const real = new Date(Date.UTC(2024, mes - 1, dia));
  return real.getUTCMonth() === mes - 1 && real.getUTCDate() === dia;
}

function dataNoTrecho(data: string, trecho: string): boolean {
  const [dia, mes] = data.split("/").map(Number);
  return new RegExp(`(^|\\D)0?${dia}\\s*[/.-]\\s*0?${mes}(\\D|$)`).test(trecho);
}

function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function objeto(item: unknown): Record<string, unknown> | null {
  return typeof item === "object" && item !== null && !Array.isArray(item)
    ? (item as Record<string, unknown>)
    : null;
}

function datasEspeciais(valor: unknown): DataEspecial[] | null {
  if (!Array.isArray(valor) || valor.length === 0) return null;
  const datas: DataEspecial[] = [];
  for (const item of valor) {
    const o = objeto(item);
    if (!o || typeof o.descricao !== "string" || o.descricao.trim() === "") return null;
    const percentual = o.percentual;
    if (typeof percentual !== "number" || !Number.isFinite(percentual) || percentual <= 0)
      return null;
    if (percentual > MAXIMO_PERCENTUAL) return null;
    const data = o.data ?? null;
    if (data !== null && (typeof data !== "string" || !dataValida(data))) return null;
    const comissionado = o.percentualComissionado;
    if (
      comissionado !== undefined &&
      (typeof comissionado !== "number" ||
        !Number.isFinite(comissionado) ||
        comissionado <= 0 ||
        comissionado > MAXIMO_PERCENTUAL)
    )
      return null;
    // O percentual do comissionado fica fora do piso: é o que a convenção paga em troca da comissão.
    datas.push({
      descricao: o.descricao.trim(),
      data,
      percentual,
      ...(comissionado === undefined ? {} : { percentualComissionado: comissionado }),
    });
  }
  return datas;
}

function excecoesDeFeriado(valor: unknown): ExcecaoDeFeriado[] | null {
  if (!Array.isArray(valor) || valor.length === 0) return null;
  const excecoes: ExcecaoDeFeriado[] = [];
  for (const item of valor) {
    const o = objeto(item);
    if (!o || typeof o.descricao !== "string" || o.descricao.trim() === "") return null;
    excecoes.push({ descricao: o.descricao.trim() });
  }
  return excecoes;
}
