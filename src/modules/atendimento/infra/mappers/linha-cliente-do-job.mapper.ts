import { z } from "zod";

export const linhaClienteDoJobSchema = z.object({
  cliente_id: z.string(),
  empresa: z.string(),
});

export const paraClienteDoJob = (l: z.infer<typeof linhaClienteDoJobSchema>) => ({
  clienteId: l.cliente_id,
  empresa: l.empresa,
});
