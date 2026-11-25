import { z } from "zod";

import { REGIMES } from "@/shared/kernel/regimes";
import { SETORES } from "@/shared/kernel/setores";

export const aberturaRowSchema = z.object({ id: z.string() });
export const anexoRowSchema = z.boolean();

export const transferenciaRowSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("transferido"),
    destinatario_nome: z.string().nullable(),
    origem_nome: z.string().nullable(),
    contato_nome: z.string().nullable(),
    empresa: z.string().nullable(),
    cnpj: z.string().nullable(),
  }),
  z.object({ status: z.literal("conflito") }),
  z.object({ status: z.literal("inexistente") }),
]);

export const atendimentoEmAndamentoRowSchema = z.object({
  id: z.string(),
  cliente_id: z.string().nullable(),
  setor: z.enum(SETORES),
  funcionario_id: z.string().nullable(),
  telefone: z.string(),
  chave_telefone: z.string(),
});

export const roteamentoDoClienteRowSchema = z.object({
  regime: z.enum(REGIMES),
  cliente_responsaveis: z.array(z.object({ setor: z.enum(SETORES), responsavel_id: z.string() })),
});

export const liderRowSchema = z.object({ id: z.string() });

export const encerramentoRowSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("encerrado") }),
  z.object({ status: z.literal("inexistente") }),
]);

export const assuncaoRowSchema = z.object({
  status: z.enum(["assumido", "inelegivel", "ja_assumido", "inexistente"]),
});

export const filaRowSchema = z.object({
  id: z.string(),
  fila_funcionario_id: z.string().nullable(),
  fila_desde: z.string(),
  telefone: z.string(),
  contato_nome: z.string().nullable(),
  empresa: z.string().nullable(),
  cnpj: z.string().nullable(),
  resumo: z.string().nullable(),
  origem_setor: z.enum(SETORES).nullable(),
  origem_nome: z.string().nullable(),
});

const clienteComContatosRowSchema = z.object({ empresa: z.string(), cnpj: z.string() }).nullable();

export const atendimentoDoFuncionarioRowSchema = z.object({
  id: z.string(),
  funcionario_id: z.string().nullable(),
  cliente_id: z.string().nullable(),
  dono: z.object({ nome: z.string() }).nullable(),
  telefone: z.string(),
  chave_telefone: z.string(),
  criado_em: z.string(),
  clientes: clienteComContatosRowSchema,
  mensagens: z.array(
    z.object({
      autor: z.enum(["contato", "ura", "funcionario"]),
      texto: z.string(),
      criado_em: z.string(),
      anexo_tipo: z.enum(["imagem", "audio", "documento"]).nullable(),
    }),
  ),
});

export const mensagemDaConversaRowSchema = z.object({
  id: z.string(),
  autor: z.enum(["contato", "ura", "funcionario"]),
  texto: z.string(),
  criado_em: z.string(),
  id_externo: z.string().nullable(),
  reacao: z.string().nullable(),
  entrega: z.enum(["pendente", "entregue", "falha"]),
  anexo_tipo: z.enum(["imagem", "audio", "documento"]).nullable(),
  anexo_nome: z.string().nullable(),
  anexo_caminho: z.string().nullable(),
  anexo_tamanho: z.number().nullable(),
  anexo_miniatura_caminho: z.string().nullable(),
  perfis: z.object({ nome: z.string(), setor: z.enum(SETORES) }).nullable(),
});

export const conversaRowSchema = z.object({
  id: z.string(),
  status: z.enum(["em_andamento", "encerrado"]),
  setor: z.enum(SETORES),
  funcionario_id: z.string().nullable(),
  cliente_id: z.string().nullable(),
  telefone: z.string(),
  chave_telefone: z.string(),
  resumo_ura: z.string().nullable(),
  cnpj_informado: z.string().nullable(),
  clientes: clienteComContatosRowSchema,
  mensagens: z.array(mensagemDaConversaRowSchema),
  transferencias: z.array(
    z.object({
      setor_origem: z.enum(SETORES),
      resumo: z.string(),
      origem: z.object({ nome: z.string() }).nullable(),
    }),
  ),
});
export const mensagemParaReacaoRowSchema = z.object({
  autor: z.enum(["contato", "ura", "funcionario"]),
  id_externo: z.string().nullable(),
  reacao: z.string().nullable(),
});

export const registroRecebidoRowSchema = z.enum(["registrada", "duplicada", "encerrada"]);

export const registroDoFuncionarioRowSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("registrada"), id: z.string() }),
  z.object({ status: z.literal("encerrada") }),
  z.object({ status: z.literal("sem_autoridade") }),
]);

export const atendimentoIdRowSchema = z.object({ id: z.string() });

export const mensagensAnterioresRowSchema = z.object({
  setor: z.enum(SETORES),
  funcionario_id: z.string().nullable(),
  mensagens: z.array(mensagemDaConversaRowSchema),
});
