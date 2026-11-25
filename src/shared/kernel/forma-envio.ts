export const FORMAS_ENVIO = ["whatsapp", "email", "whatsapp_e_email"] as const;
export type FormaEnvioValor = (typeof FORMAS_ENVIO)[number];

export const FORMA_ENVIO_LABEL: Record<FormaEnvioValor, string> = {
  whatsapp: "WhatsApp",
  email: "E-mail",
  whatsapp_e_email: "WhatsApp e E-mail",
};

export const formaEnvioUsaWhatsapp = (forma: FormaEnvioValor) => forma !== "email";
export const formaEnvioUsaEmail = (forma: FormaEnvioValor) => forma !== "whatsapp";

type CanaisDoContato = { telefone: string | null; email: string | null };
const temWhatsapp = (c: CanaisDoContato) => /\d/.test(c.telefone ?? "");
const temEmail = (c: CanaisDoContato) => Boolean(c.email?.trim());

export const temOsDoisCanais = (c: CanaisDoContato) => temWhatsapp(c) && temEmail(c);

export function canalPerdidoDoDestino(
  canal: FormaEnvioValor,
  contato: CanaisDoContato,
): "whatsapp" | "email" | null {
  if (formaEnvioUsaWhatsapp(canal) && !temWhatsapp(contato)) return "whatsapp";
  if (formaEnvioUsaEmail(canal) && !temEmail(contato)) return "email";
  return null;
}
