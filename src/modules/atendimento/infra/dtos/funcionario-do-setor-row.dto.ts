import { z } from "zod";

// `bigint` do Postgres chega como number ou string pelo PostgREST.
export const funcionarioDoSetorRowSchema = z.object({
  id: z.string(),
  atendimentos_no_mes: z.coerce.number(),
  livre: z.boolean(),
});
