import { z } from "zod";

import {
  contatoSchema,
  parcelamentosFormSchema,
} from "../editar-cadastro-operacional/editar-cadastro-operacional.schema";

// O que a action recebe: as observações do RH e os contatos do Cliente.
export const editarCadastroRhSchema = z.object({
  clienteId: z.string().uuid(),
  observacoes: z.string().max(2000),
  contatos: z.array(contatoSchema).max(50).optional(),
});

// O que o formulário valida: a tela usa os mesmos campos do formulário do SN, então as observações do RH
// ficam em `observacoesGerais`; os campos do SN não entram aqui (o zod os descarta).
export const editarCadastroRhFormSchema = z.object({
  observacoesGerais: z.string().max(2000),
  contatos: z.array(contatoSchema).max(50),
  // Os Parcelamentos vão por outra Server Action (têm PDF); aqui só se validam as linhas.
  parcelamentos: parcelamentosFormSchema,
});
