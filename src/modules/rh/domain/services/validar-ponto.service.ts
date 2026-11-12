import type { Jornada, Par } from "@/modules/rh/domain/services/totalizacao.service";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { TEXTO_CURTO_MAXIMO } from "@/shared/kernel/texto";

export function validarNome(nome: string): Result<string, ValidationError> {
  const limpo = nome.trim();
  if (limpo.length === 0 || limpo.length > TEXTO_CURTO_MAXIMO) {
    return err(
      new ValidationError(`O nome do empregado tem de 1 a ${TEXTO_CURTO_MAXIMO} caracteres.`, {
        nome: ["Nome inválido"],
      }),
    );
  }
  return ok(limpo);
}

export function validarSindicato(sindicato: string): Result<string, ValidationError> {
  const limpo = sindicato.trim();
  if (limpo.length === 0 || limpo.length > TEXTO_CURTO_MAXIMO) {
    return err(
      new ValidationError(`O sindicato tem de 1 a ${TEXTO_CURTO_MAXIMO} caracteres.`, {
        sindicato: ["Sindicato inválido"],
      }),
    );
  }
  return ok(limpo);
}

export function validarJornada(jornada: readonly number[]): Result<Jornada, ValidationError> {
  const valida =
    jornada.length === 7 && jornada.every((m) => Number.isInteger(m) && m >= 0 && m <= 1440);
  if (!valida) {
    return err(
      new ValidationError("A Jornada tem 7 dias, cada um de 0 a 24 horas.", {
        jornada: ["Jornada inválida"],
      }),
    );
  }
  return ok(jornada as Jornada);
}

function parValido({ entrada, saida }: Par): boolean {
  const horario = (m: number) => Number.isInteger(m) && m >= 0 && m <= 1439;
  // Saída igual à entrada não é jornada: viraria 24 horas.
  return horario(entrada) && horario(saida) && entrada !== saida;
}

export function validarPares(pares: Par[], maximo: number): Result<Par[], ValidationError> {
  if (pares.length > maximo || !pares.every(parValido)) {
    return err(new ValidationError("Horário inválido.", { batidas: ["Horário inválido"] }));
  }
  return ok(pares);
}
