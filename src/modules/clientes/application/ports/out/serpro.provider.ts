import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// Contrato espelhando docs/pesquisa/serpro-api.md (Integra Contador): JSON,
// PDFs em base64, CNPJ do cliente consultado em nome do escritório contratante.

// PDF devolvido pelo Serpro (guia/certidão), em base64.
export type DocumentoPdfDto = { nomeArquivo: string; pdfBase64: string };

export type GuiaDasDto = DocumentoPdfDto & {
  competencia: string; // AAAA-MM
  valorCentavos: number;
  vencimento: string; // AAAA-MM-DD
};

export type GuiaParcelamentoDto = DocumentoPdfDto & {
  parcela: string; // AAAAMM da parcela emitida
  valorCentavos: number;
  vencimento: string; // AAAA-MM-DD
};

export type CndDto = DocumentoPdfDto & { validade: string }; // AAAA-MM-DD

// Integra-Procurações (OBTERPROCURACAO41): a API só consulta, nunca concede.
export type ProcuracaoDto = { vigente: true; dataExpiracao: string } | { vigente: false }; // AAAA-MM-DD

export interface SerproPort {
  buscarDas(cnpj: string): Promise<Result<GuiaDasDto, AppError>>;
  buscarGuiaParcelamento(cnpj: string): Promise<Result<GuiaParcelamentoDto, AppError>>;
  buscarCnd(cnpj: string): Promise<Result<CndDto, AppError>>;
  consultarProcuracao(cnpj: string): Promise<Result<ProcuracaoDto, AppError>>;
}
