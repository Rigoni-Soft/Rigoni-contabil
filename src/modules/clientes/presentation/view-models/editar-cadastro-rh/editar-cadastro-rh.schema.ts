import { z } from "zod";

const contatoSchema = z.object({
  id: z.string().optional(),
  nome: z.string().min(1, "obrigatório"),
  telefone: z.string().min(1, "obrigatório"),
  padrao: z.boolean(),
});

// O que a action recebe: as observações do RH e os contatos do Cliente.
export const editarCadastroRhSchema = z.object({
  clienteId: z.string().uuid(),
  observacoes: z.string().max(2000),
  contatos: z.array(contatoSchema),
});

// O que o formulário valida: a tela usa os mesmos campos do formulário do SN, então as observações do RH
// ficam em `observacoesGerais`; os campos do SN não entram aqui (o zod os descarta).
export const editarCadastroRhFormSchema = z.object({
  observacoesGerais: z.string().max(2000),
  contatos: z.array(contatoSchema),
});
