// A leitura do atestado ou da declaração de comparecimento (visão) chega aqui ainda não confiável. Só o
// nome e as datas importam: nunca CID, documento ou imagem. O resultado é Abono por dia, e só isso.
import { nomeLegivel } from "@/modules/rh/domain/services/leitura-do-cartao.service";
import { diaDaSemana, type Jornada } from "@/modules/rh/domain/services/totalizacao.service";
import { ValidationError } from "@/shared/errors/validation.error";
import { dataIsoValida } from "@/shared/kernel/data-iso";
import { err, ok, type Result } from "@/shared/kernel/result";

export type TipoDeAtestado = "atestado" | "declaracao";
export type AtestadoLido = {
  nome: string | null;
  tipo: TipoDeAtestado;
  // "AAAA-MM-DD": início do afastamento, ou a data do comparecimento.
  de: string | null;
  ate: string | null;
};
export type AtestadoValido = { nome: string; tipo: TipoDeAtestado; de: string; ate: string };

// Afastamento mais longo que isso o RH lança à mão: o modelo que troca um dígito do ano não abona meses.
const MAXIMO_DE_DIAS = 31;
const DIA_MS = 86_400_000;

const dia = (data: string) => Date.parse(`${data}T00:00:00Z`);
const maisUmDia = (data: string) => new Date(dia(data) + DIA_MS).toISOString().slice(0, 10);

export function validarAtestado(lido: AtestadoLido): Result<AtestadoValido, ValidationError> {
  const recusa = (motivo: string) => err(new ValidationError(motivo, { atestado: [motivo] }));
  const nome = nomeLegivel(lido.nome);
  if (!nome) return recusa("Nome do atestado ilegível.");
  const { de } = lido;
  if (!de || !dataIsoValida(de)) return recusa("Data do atestado ilegível.");
  // Declaração de comparecimento vale numa data só.
  const ate = lido.tipo === "declaracao" ? de : lido.ate;
  if (!ate || !dataIsoValida(ate)) return recusa("Período do atestado ilegível.");
  const dias = (dia(ate) - dia(de)) / DIA_MS;
  if (dias < 0 || dias >= MAXIMO_DE_DIAS) return recusa("Período do atestado fora do limite.");
  return ok({ nome, tipo: lido.tipo, de, ate });
}

// Datas que ganham Abono. Atestado: dia de trabalho (com carga) ainda sem batida. Declaração: abona só o
// horário, então só o dia que tem batida (o abono cobre a diferença da carga); dia vazio é falta e o RH
// confere. `comBatida` = datas do cartão que já têm batida.
export function abonosDoAtestado(
  atestado: AtestadoValido,
  jornada: Jornada,
  comBatida: ReadonlySet<string>,
): string[] {
  const datas: string[] = [];
  for (let data = atestado.de; data <= atestado.ate; data = maisUmDia(data)) datas.push(data);
  return datas.filter((data) =>
    atestado.tipo === "declaracao"
      ? comBatida.has(data)
      : jornada[diaDaSemana(data)] > 0 && !comBatida.has(data),
  );
}
