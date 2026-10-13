import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type MensagemEnviada = { telefone: string; texto: string };

// Ou um endereço que o provedor busca (`url`), ou o próprio PDF (`pdfBase64`, que o adapter real
// sobe como mídia antes de enviar).
export type DocumentoEnviado = { telefone: string; nomeArquivo: string } & (
  { url: string } | { pdfBase64: string }
);

// Mensagem de template aprovado pela Meta; `variaveis` seguem a ordem {{1}}, {{2}}...
// `documento` vai no cabeçalho (templates de guia).
export type TemplateEnviado = {
  telefone: string;
  nome: string;
  idioma: string;
  variaveis: string[];
  documento?: { url: string; nomeArquivo: string };
};
// `emoji` vazio remove a reação. `idExterno` é o id da Mensagem do cliente no provedor.
export type ReacaoEnviada = { telefone: string; idExterno: string; emoji: string };

export interface EnvioMensagemPort {
  enviar(mensagem: MensagemEnviada): Promise<Result<void, AppError>>;
  enviarDocumento(documento: DocumentoEnviado): Promise<Result<void, AppError>>;
  enviarTemplate(template: TemplateEnviado): Promise<Result<void, AppError>>;
  reagir(reacao: ReacaoEnviada): Promise<Result<void, AppError>>;
}
