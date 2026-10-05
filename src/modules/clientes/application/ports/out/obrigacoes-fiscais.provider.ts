import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// Contrato neutro (docs/contratos/obrigacoes-fiscais.md): nada aqui conhece um
// provedor específico. Quem traduz pro Serpro (ou outro) é o adapter real.

// PDF devolvido pelo provedor (guia/certidão), em base64.
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

// O Cliente autorizou o escritório a consultar os dados dele? O sistema só
// reflete esse estado, nunca o concede.
export type AutorizacaoDto = { vigente: true; dataExpiracao: string } | { vigente: false }; // AAAA-MM-DD

export interface ObrigacoesFiscaisPort {
  buscarDas(cnpj: string): Promise<Result<GuiaDasDto, AppError>>;
  buscarGuiaParcelamento(cnpj: string): Promise<Result<GuiaParcelamentoDto, AppError>>;
  buscarCnd(cnpj: string): Promise<Result<CndDto, AppError>>;
  consultarAutorizacao(cnpj: string): Promise<Result<AutorizacaoDto, AppError>>;
}
