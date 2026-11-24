import { z } from "zod";

import {
  contatoSchema,
  parcelamentosFormSchema,
} from "../editar-cadastro-operacional/editar-cadastro-operacional.schema";

export const editarCadastroRhSchema = z.object({
  clienteId: z.string().uuid(),
  observacoes: z.string().max(2000),
  contatos: z.array(contatoSchema).max(50).optional(),
});

export const editarCadastroRhFormSchema = z.object({
  observacoesGerais: z.string().max(2000),
  contatos: z.array(contatoSchema).max(50),
  parcelamentos: parcelamentosFormSchema,
});
