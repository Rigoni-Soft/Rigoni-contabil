import { z } from "zod";

import {
  contatoSchema,
  parcelamentosFormSchema,
} from "../editar-cadastro-operacional/editar-cadastro-operacional.schema";

const MAXIMO_DE_CARACTERES_DAS_OBSERVACOES = 2000;
const MAXIMO_DE_CONTATOS_POR_CADASTRO = 50;

export const editarCadastroRhSchema = z.object({
  clienteId: z.string().uuid(),
  observacoes: z.string().max(MAXIMO_DE_CARACTERES_DAS_OBSERVACOES),
  contatos: z.array(contatoSchema).max(MAXIMO_DE_CONTATOS_POR_CADASTRO).optional(),
});

export const editarCadastroRhFormSchema = z.object({
  observacoesGerais: z.string().max(MAXIMO_DE_CARACTERES_DAS_OBSERVACOES),
  contatos: z.array(contatoSchema).max(MAXIMO_DE_CONTATOS_POR_CADASTRO),
  parcelamentos: parcelamentosFormSchema,
});
