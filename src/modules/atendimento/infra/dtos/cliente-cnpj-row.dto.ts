import { z } from "zod";

// Linha de `clientes` com só o CNPJ (14 caracteres `[0-9A-Z]`, sem máscara).
export const clienteCnpjRowSchema = z.object({ cnpj: z.string().regex(/^[0-9A-Z]{14}$/) });
