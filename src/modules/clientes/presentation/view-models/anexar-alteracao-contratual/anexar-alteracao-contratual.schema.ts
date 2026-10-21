import { z } from "zod";

import { arquivoDocumento } from "@/modules/clientes/presentation/view-models/criar-cliente/criar-cliente.schema";
import {
  ERRO_ARQUIVO_GRANDE,
  ERRO_DATA_FUTURA,
  LIMITE_ARQUIVO_BYTES,
} from "@/shared/kernel/limite-arquivo";
import { hojeIso } from "@/shared/kernel/mes-atual";
import { ERRO_NUMERO_INVALIDO, erroDeFormato } from "@/shared/kernel/numero-alteracao";

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
