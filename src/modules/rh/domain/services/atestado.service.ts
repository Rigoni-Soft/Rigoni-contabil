import { nomeLegivel } from "@/modules/rh/domain/services/leitura-do-cartao.service";
import {
  diaDaSemana,
  ehDiaDeTrabalho,
  type Jornada,
} from "@/modules/rh/domain/services/totalizacao.service";
import { ValidationError } from "@/shared/errors/validation.error";
import { dataIsoValida } from "@/shared/kernel/data-iso";
import { err, ok, type Result } from "@/shared/kernel/result";

export type TipoDeAtestado = "atestado" | "declaracao";
export type AtestadoLido = {
  nome: string | null;
  tipo: TipoDeAtestado;
  de: string | null;
  ate: string | null;
};
export type AtestadoValido = { nome: string; tipo: TipoDeAtestado; de: string; ate: string };

const MAXIMO_DE_DIAS = 31;
const DIA_MS = 86_400_000;

const milissegundosDoDia = (data: string) => Date.parse(`${data}T00:00:00Z`);
const maisUmDia = (data: string) =>
  new Date(milissegundosDoDia(data) + DIA_MS).toISOString().slice(0, 10);

export function validarAtestado(lido: AtestadoLido): Result<AtestadoValido, ValidationError> {
  const recusa = (motivo: string) => err(new ValidationError(motivo, { atestado: [motivo] }));
  const nome = nomeLegivel(lido.nome);
  if (!nome) return recusa("Nome do atestado ilegível.");
  const { de } = lido;
  if (!de || !dataIsoValida(de)) return recusa("Data do atestado ilegível.");
  const ate = lido.tipo === "declaracao" ? de : lido.ate;
  if (!ate || !dataIsoValida(ate)) return recusa("Período do atestado ilegível.");
  const dias = (milissegundosDoDia(ate) - milissegundosDoDia(de)) / DIA_MS;
  if (dias < 0 || dias >= MAXIMO_DE_DIAS) return recusa("Período do atestado fora do limite.");
  return ok({ nome, tipo: lido.tipo, de, ate });
}

export function competenciasDoAtestado(atestado: AtestadoValido): string[] {
  return [...new Set([atestado.de, atestado.ate].map((data) => `${data.slice(0, 7)}-01`))];
}

export function abonosDoAtestado(
  atestado: AtestadoValido,
  jornada: Jornada,
  comBatida: ReadonlySet<string>,
  feriados: ReadonlySet<string>,
): string[] {
  const datas: string[] = [];
  for (let data = atestado.de; data <= atestado.ate; data = maisUmDia(data)) datas.push(data);
  return datas.filter((data) =>
    atestado.tipo === "declaracao"
      ? comBatida.has(data)
      : ehDiaDeTrabalho(jornada[diaDaSemana(data)], feriados.has(data)) && !comBatida.has(data),
  );
}
