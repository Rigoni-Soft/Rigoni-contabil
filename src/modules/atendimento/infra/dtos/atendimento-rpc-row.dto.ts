import { z } from "zod";

import { REGIMES } from "@/shared/kernel/regimes";
import { SETORES } from "@/shared/kernel/setores";

// `abrir_atendimento`: o Atendimento e o Funcionário que ficou com ele (null = Fila), ou null se o
// Funcionário escolhido foi ocupado.
export const aberturaRowSchema = z
  .object({ id: z.string(), funcionario_id: z.string().nullable() })
  .nullable();
// `anexar_mensagem_atendimento`: true se havia Atendimento em andamento.
export const anexoRowSchema = z.boolean();

// Atendimento que um Funcionário liberado assumiu da Fila (`assumir_proximo_da_fila`).
const assumidoRowSchema = z.object({
  id: z.string(),
  telefone: z.string(),
  chave: z.string(),
  funcionario_nome: z.string().nullable(),
});

// `transferir_atendimento`: `status` e, quando transferido, os nomes/dados do destino.
export const transferenciaRowSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("transferido"),
    proximo_da_origem: assumidoRowSchema.nullable(),
    na_fila: z.boolean(),
    destinatario_nome: z.string().nullable(),
    origem_nome: z.string().nullable(),
    contato_nome: z.string().nullable(),
    empresa: z.string().nullable(),
    cnpj: z.string().nullable(),
  }),
  z.object({ status: z.literal("conflito") }),
  z.object({ status: z.literal("inexistente") }),
]);

// Linha de `atendimentos` lida para decidir a Transferência.
export const atendimentoEmAndamentoRowSchema = z.object({
  id: z.string(),
  cliente_id: z.string().nullable(),
  setor: z.enum(SETORES),
  funcionario_id: z.string().nullable(),
  telefone: z.string(),
  chave_telefone: z.string(),
});

// `clientes` com o cadastro operacional embutido (1:1; só MEI/Simples Nacional têm linha).
export const roteamentoDoClienteRowSchema = z.object({
  regime: z.enum(REGIMES),
  cliente_cadastro_operacional_sn: z.object({ responsavel_id: z.string().nullable() }).nullable(),
});

export const liderRowSchema = z.object({ id: z.string() });

// `posicao_na_fila`: null se o Atendimento não está em Fila.
export const posicaoRowSchema = z.number().int().nullable();
// `encerrar_atendimento`: `inexistente` se não estava em andamento com o dono informado.
export const encerramentoRowSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("encerrado"), proximo: assumidoRowSchema.nullable() }),
  z.object({ status: z.literal("inexistente") }),
]);

export const filaRowSchema = z.object({
  id: z.string(),
  posicao: z.number().int(),
  fila_funcionario_id: z.string().nullable(),
  fila_desde: z.string(),
  telefone: z.string(),
  contato_nome: z.string().nullable(),
  empresa: z.string().nullable(),
  cnpj: z.string().nullable(),
  resumo: z.string().nullable(),
});
