import { z } from "zod";

// Linhas que o acompanhamento lê página a página (o PostgREST corta em 1000): validadas antes de agrupar.

export const responsavelDoClienteRowSchema = z.object({
  cliente_id: z.guid(),
  responsavel_id: z.guid(),
  responsavel: z.object({ nome: z.string() }).nullable(),
});

export const clienteDoAcompanhamentoRowSchema = z.object({
  id: z.guid(),
  empresa: z.string(),
  cnpj: z.string(),
});

export const naoAplicaRowSchema = z.object({
  cliente_id: z.guid(),
  servico_id: z.guid(),
  competencia: z.string().nullable(),
});

export const marcacaoRowSchema = z.object({ cliente_id: z.guid(), servico_id: z.guid() });

export const cartoesDoMesRowSchema = z.object({
  cliente_id: z.guid(),
  cadastrados: z.number(),
  sem_movimento: z.number(),
  cartoes: z.number(),
});

export const servicoRowSchema = z.object({
  id: z.guid(),
  nome: z.string(),
  sistema: z.boolean(),
  ativo_desde: z.string(),
  desativado_em: z.string().nullable(),
});

export const clienteDoAcompanhamentoBasicoRowSchema = z.object({ cnpj: z.string() });
