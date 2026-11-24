import { z } from "zod";

import {
  arquivoDocumento,
  dataNaoFutura,
} from "@/modules/clientes/presentation/view-models/criar-cliente/criar-cliente.schema";
import { ERRO_NUMERO_INVALIDO, erroDeFormato } from "@/shared/kernel/numero-alteracao";

const LIMITE_ARQUIVO_BYTES = 4 * 1024 * 1024;
const ERRO_ARQUIVO_GRANDE = "O arquivo passa de 4 MB. Envie um arquivo menor.";

export const anexarAlteracaoContratualSchema = z.object({
  clienteId: z.guid(),
  numero: z
    .number({ error: "Nº obrigatório" })
    .refine((n) => !erroDeFormato(n), ERRO_NUMERO_INVALIDO),
  data: dataNaoFutura,
  arquivo: arquivoDocumento("Arquivo obrigatório").refine(
    (arquivo) => arquivo.size <= LIMITE_ARQUIVO_BYTES,
    ERRO_ARQUIVO_GRANDE,
  ),
});
