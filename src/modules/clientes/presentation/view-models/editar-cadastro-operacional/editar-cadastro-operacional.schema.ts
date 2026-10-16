import { z } from "zod";

import { DAS_STATUSES } from "@/shared/kernel/das-status";
import { DOCUMENTO_OBRIGATORIO_STATUSES } from "@/shared/kernel/documento-obrigatorio-status";
import { FORMAS_ENVIO } from "@/shared/kernel/forma-envio";
import { PARCELAMENTO_STATUSES } from "@/shared/kernel/parcelamento-status";

export const editarCadastroOperacionalSchema = z.object({
  clienteId: z.string().uuid(),
  formaEnvio: z.enum(FORMAS_ENVIO),
  contatos: z.array(
    z.object({
      id: z.string().optional(),
      nome: z.string().min(1, "obrigatório"),
      telefone: z.string().min(1, "obrigatório"),
      padrao: z.boolean(),
    }),
  ),
  documentoObrigatorio: z.enum(DOCUMENTO_OBRIGATORIO_STATUSES).nullable(),
  dasStatus: z.enum(DAS_STATUSES).nullable(),
  dataEnvioDas: z.iso.date().nullable(),
  temParcelamento: z.boolean(),
  parcelamentoStatus: z.enum(PARCELAMENTO_STATUSES).nullable(),
  observacoesGerais: z.string().max(2000),
  atividadeMes: z.object({
    industria: z.boolean(),
    comercio: z.boolean(),
    servico: z.boolean(),
  }),
});

export type EditarCadastroOperacionalInput = z.infer<typeof editarCadastroOperacionalSchema>;

// clienteId nunca é digitado pelo Funcionário — vem do parâmetro da rota (Container injeta antes de
// chamar a Server Action). Removê-lo do resolver do formulário evita depender de um input escondido
// só pra carregar um valor que o React Hook Form já não precisa validar no cliente. responsavelId
// vai por outra Server Action (só o Líder do SN atribui) — aqui só viaja no formulário; o schema da
// action de edição o descarta.
export const editarCadastroOperacionalFormSchema = editarCadastroOperacionalSchema
  .omit({ clienteId: true })
  .extend({ responsavelId: z.string() });
export type EditarCadastroOperacionalFormValues = z.infer<
  typeof editarCadastroOperacionalFormSchema
>;
