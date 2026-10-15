// Forma de envio de documentos/comunicação com o Cliente (#34) — domain
// (clientes) e Views globais precisam da mesma lista, sem cruzar a fronteira
// do módulo (arquitetura.md, seção 3.4).
export const FORMAS_ENVIO = ["whatsapp", "email", "whatsapp_e_email"] as const;
export type FormaEnvioValor = (typeof FORMAS_ENVIO)[number];

export const FORMA_ENVIO_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp",
  email: "E-mail",
  whatsapp_e_email: "WhatsApp e E-mail",
};

// Canais que a forma de envio inclui.
export const formaEnvioUsaWhatsapp = (forma: FormaEnvioValor) => forma !== "email";
export const formaEnvioUsaEmail = (forma: FormaEnvioValor) => forma !== "whatsapp";

// Há para quem enviar pela forma de envio: contato padrão (WhatsApp) e/ou e-mail.
export const temDestinatario = (c: {
  formaEnvio: FormaEnvioValor;
  contato: unknown;
  email: string | null;
}) =>
  (formaEnvioUsaWhatsapp(c.formaEnvio) && c.contato !== null) ||
  (formaEnvioUsaEmail(c.formaEnvio) && c.email !== null);
