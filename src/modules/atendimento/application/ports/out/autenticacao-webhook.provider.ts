// Prova de origem de um webhook recebido: assinatura do corpo cru e token do
// handshake de verificação. O segredo fica na infra, nunca no handler.
export interface AutenticacaoWebhookPort {
  assinaturaValida(corpoCru: string, assinatura: string | null): boolean;
  tokenValido(token: string | null): boolean;
}
