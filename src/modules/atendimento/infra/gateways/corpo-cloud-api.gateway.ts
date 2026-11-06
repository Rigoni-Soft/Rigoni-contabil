import type {
  AnexoEnviado,
  ReacaoEnviada,
  TemplateEnviado,
} from "@/modules/atendimento/application/ports/out/envio-mensagem.provider";

// Corpo de `POST /{phone-number-id}/messages` da WhatsApp Cloud API (Meta), compartilhado pelo
// adapter real e pelo falso pra que o falso não divirja do que vai pro provedor.
export type TemplateComponents = (
  | {
      type: "header";
      parameters: { type: "document"; document: { link: string; filename: string } }[];
    }
  | { type: "body"; parameters: { type: "text"; text: string }[] }
)[];

export type ParteCorpo = { to: string } & (
  | { type: "text"; text: { body: string } }
  | {
      type: "document";
      document: ({ link: string } | { id: string }) & { filename: string; caption?: string };
    }
  | { type: "image"; image: { link: string; caption?: string } }
  | { type: "audio"; audio: { link: string } }
  | {
      type: "template";
      template: { name: string; language: { code: string }; components: TemplateComponents };
    }
  | { type: "reaction"; reaction: { message_id: string; emoji: string } }
);

export type CorpoEnvioCloudApi = {
  messaging_product: "whatsapp";
  recipient_type: "individual";
} & ParteCorpo;

export const envelope = (parte: ParteCorpo): CorpoEnvioCloudApi => ({
  messaging_product: "whatsapp",
  recipient_type: "individual",
  ...parte,
});

export function parteTemplate(template: TemplateEnviado): ParteCorpo {
  const { documento } = template;
  const components: TemplateComponents = [];
  if (documento) {
    const document = { link: documento.url, filename: documento.nomeArquivo };
    components.push({ type: "header", parameters: [{ type: "document", document }] });
  }
  components.push({
    type: "body",
    parameters: template.variaveis.map((text) => ({ type: "text", text })),
  });
  return {
    to: template.telefone,
    type: "template",
    template: { name: template.nome, language: { code: template.idioma }, components },
  };
}

export function parteAnexo(anexo: AnexoEnviado): ParteCorpo {
  const { telefone: to, url, nomeArquivo, legenda } = anexo;
  // Áudio não tem legenda na Cloud API; imagem e documento têm `caption`.
  const caption = legenda ? { caption: legenda } : {};
  if (anexo.tipo === "imagem") return { to, type: "image", image: { link: url, ...caption } };
  if (anexo.tipo === "audio") return { to, type: "audio", audio: { link: url } };
  return { to, type: "document", document: { link: url, filename: nomeArquivo, ...caption } };
}

export const parteReacao = (reacao: ReacaoEnviada): ParteCorpo => ({
  to: reacao.telefone,
  type: "reaction",
  reaction: { message_id: reacao.idExterno, emoji: reacao.emoji },
});
