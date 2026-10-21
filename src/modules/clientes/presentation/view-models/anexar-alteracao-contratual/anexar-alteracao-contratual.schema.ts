import { z } from "zod";

import { arquivoDocumento } from "@/modules/clientes/presentation/view-models/criar-cliente/criar-cliente.schema";
import { hojeIso } from "@/shared/kernel/mes-atual";
import { ERRO_NUMERO_INVALIDO, erroDeFormato } from "@/shared/kernel/numero-alteracao";

// Teto de 4,5 MB do corpo de uma Server Action na Vercel (ADR 0007): 4 MB deixa folga para o resto.
const LIMITE_ARQUIVO_BYTES = 4 * 1024 * 1024;
const ERRO_ARQUIVO_GRANDE = "O arquivo passa de 4 MB. Envie um arquivo menor.";
const ERRO_DATA_FUTURA = "A data da alteração não pode ser futura.";

// Nº repetido não entra aqui: o schema não conhece as alterações do Cliente (a tela checa pela lista
// carregada; o banco recusa por 23505). Divergência nº × data só avisa, não bloqueia.
export const anexarAlteracaoContratualSchema = z.object({
  clienteId: z.guid(),
  numero: z
    .number({ error: "Nº obrigatório" })
    .refine((n) => !erroDeFormato(n), ERRO_NUMERO_INVALIDO),
  data: z
    .string()
    .min(1, "Data obrigatória")
    .refine((data) => data <= hojeIso(), ERRO_DATA_FUTURA),
  arquivo: arquivoDocumento("Arquivo obrigatório").refine(
    (arquivo) => arquivo.size <= LIMITE_ARQUIVO_BYTES,
    ERRO_ARQUIVO_GRANDE,
  ),
});
