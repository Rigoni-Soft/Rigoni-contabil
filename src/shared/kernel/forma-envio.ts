// Forma de envio de documentos/comunicação com o Cliente — domain (clientes) e Views globais
// precisam da mesma lista, sem cruzar a fronteira do módulo (arquitetura.md, seção 3.4).
export const FORMAS_ENVIO = ["whatsapp", "email", "whatsapp_e_email"] as const;
export type FormaEnvioValor = (typeof FORMAS_ENVIO)[number];

// Canais que a forma de envio inclui.
export const formaEnvioUsaWhatsapp = (forma: FormaEnvioValor) => forma !== "email";
export const formaEnvioUsaEmail = (forma: FormaEnvioValor) => forma !== "whatsapp";

// Canais que o Contato tem (WhatsApp = número com dígitos; e-mail preenchido), para o canal do Destino.
type CanaisDoContato = { telefone: string | null; email: string | null };
const temWhatsapp = (c: CanaisDoContato) => /\d/.test(c.telefone ?? "");
const temEmail = (c: CanaisDoContato) => Boolean(c.email?.trim());

// O contato tem os dois canais: só nele o Setor escolhe por onde enviar (com um canal só, é o dele).
export const temOsDoisCanais = (c: CanaisDoContato) => temWhatsapp(c) && temEmail(c);

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
