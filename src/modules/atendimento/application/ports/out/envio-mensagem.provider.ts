import type { AppError } from "@/shared/errors/app.error";
import type { TipoAnexoMensagem } from "@/shared/kernel/anexo";
import type { Result } from "@/shared/kernel/result";

export type MensagemEnviada = { telefone: string; texto: string; chaveIdempotencia?: string };

export type DocumentoEnviado = {
  telefone: string;
  nomeArquivo: string;
  chaveIdempotencia?: string;
} & ({ url: string } | { pdfBase64: string });

export type TemplateEnviado = {
  telefone: string;
  nome: string;
  idioma: string;
  variaveis: string[];
  documento?: { url: string; nomeArquivo: string };
};
export type AnexoEnviado = {
  telefone: string;
  tipo: TipoAnexoMensagem;
  url: string;
  nomeArquivo: string;
  legenda?: string;
  chaveIdempotencia?: string;
};

export type ReacaoEnviada = { telefone: string; idExterno: string; emoji: string };

export interface EnvioMensagemPort {
  enviar(mensagem: MensagemEnviada): Promise<Result<void, AppError>>;
  enviarDocumento(documento: DocumentoEnviado): Promise<Result<void, AppError>>;
  enviarTemplate(template: TemplateEnviado): Promise<Result<void, AppError>>;
  enviarAnexo(anexo: AnexoEnviado): Promise<Result<void, AppError>>;
  reagir(reacao: ReacaoEnviada): Promise<Result<void, AppError>>;
}
