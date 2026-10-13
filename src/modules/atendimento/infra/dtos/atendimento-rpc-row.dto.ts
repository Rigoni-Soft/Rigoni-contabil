import { z } from "zod";

import { REGIMES } from "@/shared/kernel/regimes";
import { SETORES } from "@/shared/kernel/setores";

// `abrir_atendimento`: o Atendimento e o Funcionário que ficou com ele (null = Fila), ou null se o
// Funcionário escolhido foi ocupado.
export const aberturaRowSchema = z
  .object({
    id: z.string(),
    funcionario_id: z.string().nullable(),
    promovido: z.lazy(() => assumidoRowSchema).nullable(),
  })
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
    promovido: assumidoRowSchema.nullable(),
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
  aviso_inatividade_em: z.string().nullable(),
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

// `atendimentos_para_inatividade`.
export const inatividadeRowSchema = z.object({
  id: z.string(),
  setor: z.enum(SETORES),
  funcionario_id: z.string(),
  telefone: z.string(),
  chave_telefone: z.string(),
  ultima_do_contato: z.string().nullable(),
  ultima_do_funcionario: z.string().nullable(),
  aviso_inatividade_em: z.string().nullable(),
  aviso_inatividade_de: z.enum(["contato", "funcionario"]).nullable(),
  aviso_entregue_em: z.string().nullable(),
});

export const encerramentoPendenteRowSchema = z.object({
  id: z.string(),
  telefone: z.string(),
  texto: z.string().nullable(),
  reivindicacao: z.string(),
});

// `encerrar_atendimento_por_inatividade`: o encerrado traz o token da reivindicação.
export const encerramentoPorInatividadeRowSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("encerrado"),
    proximo: assumidoRowSchema.nullable(),
    reivindicacao: z.string(),
  }),
  z.object({ status: z.literal("inexistente") }),
]);
// `clientes` embutido num Atendimento, com os Contatos para achar quem escreve pelo telefone.
const clienteComContatosRowSchema = z
  .object({
    empresa: z.string(),
    cnpj: z.string(),
    cliente_contatos: z.array(
      z.object({
        nome: z.string(),
        telefone: z.string(),
        padrao: z.boolean(),
        criado_em: z.string(),
      }),
    ),
  })
  .nullable();

export const atendimentoDoFuncionarioRowSchema = z.object({
  id: z.string(),
  telefone: z.string(),
  chave_telefone: z.string(),
  criado_em: z.string(),
  clientes: clienteComContatosRowSchema,
  // Só a mais recente (a consulta pede uma, da mais nova para a mais antiga).
  mensagens: z.array(
    z.object({
      autor: z.enum(["contato", "ura", "funcionario"]),
      texto: z.string(),
      criado_em: z.string(),
      anexo_tipo: z.enum(["imagem", "audio", "documento"]).nullable(),
    }),
  ),
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
  aviso_inatividade_em: z.string().nullable(),
  aviso_inatividade_de: z.enum(["contato", "funcionario"]).nullable(),
  clientes: clienteComContatosRowSchema,
  mensagens: z.array(
    z.object({
      id: z.string(),
      autor: z.enum(["contato", "ura", "funcionario"]),
      texto: z.string(),
      criado_em: z.string(),
      id_externo: z.string().nullable(),
      reacao: z.string().nullable(),
      anexo_tipo: z.enum(["imagem", "audio", "documento"]).nullable(),
      anexo_nome: z.string().nullable(),
      anexo_caminho: z.string().nullable(),
      anexo_tamanho: z.number().nullable(),
      anexo_miniatura_caminho: z.string().nullable(),
      perfis: z.object({ nome: z.string(), setor: z.enum(SETORES) }).nullable(),
    }),
  ),
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
