import { z } from "zod";

import { SETORES } from "@/shared/kernel/setores";

// `abrir_atendimento`: uuid do Atendimento, ou null se o Funcionário escolhido foi ocupado.
export const aberturaRowSchema = z.string().nullable();
// `anexar_mensagem_atendimento`: true se havia Atendimento em andamento.
export const anexoRowSchema = z.boolean();

// `transferir_atendimento`: `status` e, quando transferido, os nomes/dados do destino.
export const transferenciaRowSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("transferido"),
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
  regime: z.string(),
  cliente_cadastro_operacional_sn: z.object({ responsavel_id: z.string().nullable() }).nullable(),
});

export const liderRowSchema = z.object({ id: z.string() });
