import { z } from "zod";

// Linhas lidas pela Folha de ponto: formato exato das tabelas, validado antes de virar DTO. Se o banco
// divergir, a leitura falha alto em vez de levar um valor torto até a tela.

const minuto = z.number().int().min(0).max(1440);
const par = z.object({ entrada: minuto, saida: minuto });
const jornada = z.tuple([minuto, minuto, minuto, minuto, minuto, minuto, minuto]);

export const empregadoRowSchema = z.object({
  id: z.guid(),
  nome: z.string(),
  jornada,
  comissionado: z.boolean(),
  ativo: z.boolean(),
});

export const empregadoConvencaoRowSchema = z.object({
  id: z.guid(),
  convencao_sindicato: z.string().nullable(),
});

export const empregadoClienteRowSchema = z.object({ cliente_id: z.guid() });
export const empregadoIdRowSchema = z.object({ empregado_id: z.guid() });

export const diaDoPontoRowSchema = z.object({
  data: z.iso.date(),
  batidas: z.array(par),
  extra: par.nullable(),
  abono: z.boolean(),
});

export const feriadoRowSchema = z.object({ data: z.iso.date() });

export const clienteBasicoRowSchema = z.object({ cnpj: z.string(), empresa: z.string() });
export const responsavelRowSchema = z.object({ responsavel_id: z.guid() });

export const padraoRowSchema = z.object({ comissionados: z.boolean() });
export const interruptoresRowSchema = z.object({
  banco_de_horas: z.boolean(),
  trabalho_aos_domingos: z.boolean(),
});
