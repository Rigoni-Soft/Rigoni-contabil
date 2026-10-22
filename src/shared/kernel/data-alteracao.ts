import { z } from "zod";

import { hojeIso } from "@/shared/kernel/mes-atual";

export const ERRO_DATA_FUTURA = "A data da alteração não pode ser futura.";

// Data canônica "AAAA-MM-DD" válida e não futura no fuso de negócio (São Paulo).
export const dataNaoFutura = z.iso
  .date({ error: (i) => (i.input === "" ? "Data obrigatória" : "Data inválida") })
  .refine((data) => data <= hojeIso(), ERRO_DATA_FUTURA);
