import { z } from "zod";

import { FORMAS_ENVIO } from "@/shared/kernel/forma-envio";

import { contatoSchema } from "./editar-cadastro-operacional.schema";

// Um Destino de envio do Setor: o Contato já cadastrado (só o id) ou um novo (criado junto), o tipo
// do catálogo do Setor (null = "todos os envios do Setor") e o canal, sempre explícito.
export const definirDestinoSchema = z.object({
  clienteId: z.guid(),
  contato: z.union([z.object({ id: z.guid() }), z.object({ novo: contatoSchema })]),
  tipo: z.string().trim().max(60).nullable(),
  canal: z.enum(FORMAS_ENVIO, { error: "Escolha a forma de envio." }),
});

export const removerDestinoSchema = z.object({ destinoId: z.guid() });
