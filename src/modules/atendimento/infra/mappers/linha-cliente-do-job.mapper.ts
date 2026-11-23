import { z } from "zod";

// Colunas que as RPCs de leitura dos jobs de comunicação devolvem sobre o Cliente. Quem recebe a guia
// vem dos Destinos de envio (`destinos_de_envio_do_job`), não daqui.
export const linhaClienteDoJobSchema = z.object({
  cliente_id: z.string(),
  empresa: z.string(),
});

export const paraClienteDoJob = (l: z.infer<typeof linhaClienteDoJobSchema>) => ({
  clienteId: l.cliente_id,
  empresa: l.empresa,
});
