import { z } from "zod";

import { FORMAS_ENVIO } from "@/shared/kernel/forma-envio";

// Colunas que as RPCs de leitura dos jobs de comunicação devolvem sobre quem recebe a guia.
export const linhaDestinatarioSchema = z.object({
  cliente_id: z.string(),
  email: z.string().nullable(),
  empresa: z.string(),
  forma_envio: z.enum(FORMAS_ENVIO),
  contato_nome: z.string().nullable(),
  contato_telefone: z.string().nullable(),
  ultima_mensagem_do_contato_em: z.string().nullable(),
});

export const paraDestinatario = (l: z.infer<typeof linhaDestinatarioSchema>) => ({
  clienteId: l.cliente_id,
  empresa: l.empresa,
  formaEnvio: l.forma_envio,
  contato:
    l.contato_nome && l.contato_telefone
      ? { nome: l.contato_nome, telefone: l.contato_telefone }
      : null,
  email: l.email,
  ultimaMensagemDoContatoEm: l.ultima_mensagem_do_contato_em
    ? new Date(l.ultima_mensagem_do_contato_em)
    : null,
});
