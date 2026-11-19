// Forma de envio de documentos/comunicação com o Cliente — domain (clientes) e Views globais
// precisam da mesma lista, sem cruzar a fronteira do módulo (arquitetura.md, seção 3.4).
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

// Canais que o Contato tem (WhatsApp = número com dígitos; e-mail preenchido), para o canal do Destino.
type CanaisDoContato = { telefone: string | null; email: string | null };
const temWhatsapp = (c: CanaisDoContato) => /\d/.test(c.telefone ?? "");
const temEmail = (c: CanaisDoContato) => Boolean(c.email?.trim());

// O que o Destino pode usar do Contato: um canal só vira esse canal; os dois canais pedem escolha
// (WhatsApp, e-mail ou os dois). Contato sem canal não tem opção.
export function canaisDoContato(contato: CanaisDoContato): FormaEnvioValor[] {
  if (temWhatsapp(contato) && temEmail(contato)) return [...FORMAS_ENVIO];
  if (temWhatsapp(contato)) return ["whatsapp"];
  if (temEmail(contato)) return ["email"];
  return [];
}

// O canal do Destino que o Contato deixou de ter (o número ou o e-mail foi removido); null = tudo certo.
export function canalPerdidoDoDestino(
  canal: FormaEnvioValor,
  contato: CanaisDoContato,
): "whatsapp" | "email" | null {
  if (formaEnvioUsaWhatsapp(canal) && !temWhatsapp(contato)) return "whatsapp";
  if (formaEnvioUsaEmail(canal) && !temEmail(contato)) return "email";
  return null;
}

// Há para quem enviar pela forma de envio: contato padrão (WhatsApp) e/ou e-mail.
export const temDestinatario = (c: {
  formaEnvio: FormaEnvioValor;
  contato: unknown;
  email: string | null;
}) =>
  (formaEnvioUsaWhatsapp(c.formaEnvio) && c.contato !== null) ||
  (formaEnvioUsaEmail(c.formaEnvio) && c.email !== null);
