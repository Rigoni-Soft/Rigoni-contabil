export interface AutenticacaoWebhookPort {
  assinaturaValida(corpoCru: string, assinatura: string | null): boolean;
  tokenValido(token: string | null): boolean;
}
