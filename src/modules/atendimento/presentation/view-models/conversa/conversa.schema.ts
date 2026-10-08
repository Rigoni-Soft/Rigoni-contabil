import { z } from "zod";

// z.guid(), não z.uuid(): mesmo critério do feed de auditoria (a coluna aceita qualquer 8-4-4-4-12).
export const atendimentoIdSchema = z.guid("Atendimento inválido.");

// Contrato social não tem data; alteração contratual tem (AAAA-MM-DD).
export const enviarDocumentoSchema = z
  .object({
    atendimentoId: atendimentoIdSchema,
    documento: z.object({
      tipo: z.enum(["contrato", "alteracao"]),
      data: z.iso.date().nullable(),
    }),
  })
  .superRefine(({ documento }, ctx) => {
    if ((documento.tipo === "alteracao") !== (documento.data !== null)) {
      ctx.addIssue({
        code: "custom",
        message: "Só a alteração contratual tem data.",
        path: ["documento", "data"],
      });
    }
  });

export type EnviarDocumentoValues = z.infer<typeof enviarDocumentoSchema>;
