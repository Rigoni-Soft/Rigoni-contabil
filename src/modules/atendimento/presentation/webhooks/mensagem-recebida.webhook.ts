import { z } from "zod";

const midiaSchema = z.object({
  id: z.string().optional(),
  mime_type: z.string().optional(),
  caption: z.string().optional(),
  filename: z.string().optional(),
});

export const mensagemSchema = z.object({
  from: z.string().min(1),
  id: z.string(),
  type: z.string().optional(),
  text: z.object({ body: z.string() }).optional(),
  audio: midiaSchema.optional(),
  image: midiaSchema.optional(),
  document: midiaSchema.optional(),
});

export type MensagemDaNotificacao = z.infer<typeof mensagemSchema>;

export type MensagemClassificada =
  | { tipo: "texto"; telefone: string; texto: string; id?: string }
  | {
      tipo: "midia";
      telefone: string;
      id?: string;
      midia: { id: string; mime: string; nome?: string };
      legenda?: string;
    };

export function classificarMensagem(mensagem: MensagemDaNotificacao): MensagemClassificada {
  const id = mensagem.id || undefined;
  const telefone = mensagem.from;
  const midia = mensagem.audio ?? mensagem.image ?? mensagem.document;
  if (mensagem.text || !midia?.id) {
    return { tipo: "texto", telefone, texto: mensagem.text?.body ?? "", id };
  }
  return {
    tipo: "midia",
    telefone,
    id,
    midia: { id: midia.id, mime: midia.mime_type ?? "", nome: midia.filename },
    legenda: midia.caption,
  };
}
