import { z } from "zod";

// Colunas que as RPCs de leitura dos jobs de comunicação devolvem sobre o Cliente. Quem recebe a guia
// vem dos Destinos de envio (`destinos_de_envio_do_job`), não daqui.
export const linhaDestinatarioSchema = z.object({
  cliente_id: z.string(),
  empresa: z.string(),
});

export const paraDestinatario = (l: z.infer<typeof linhaDestinatarioSchema>) => ({
  clienteId: l.cliente_id,
  empresa: l.empresa,
});
