import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type DocumentoPdfDto = { nomeArquivo: string; pdfBase64: string };

export type GuiaDasDto = DocumentoPdfDto & {
  competencia: string;
  valorCentavos: number;
  vencimento: string;
};

export type GuiaParcelamentoDto = DocumentoPdfDto & {
  parcela: string;
  valorCentavos?: number;
  vencimento?: string;
};

export type AutorizacaoDto = { vigente: true; dataExpiracao: string } | { vigente: false };

export type RegimeParcelamento = "simples_nacional" | "mei";

export type PedidoGuiasParcelamento = {
  regime: RegimeParcelamento;
  ignorar: readonly string[];
};

export interface ObrigacoesFiscaisPort {
  buscarDas(cnpj: string): Promise<Result<GuiaDasDto, AppError>>;
  buscarGuiasParcelamento(
    cnpj: string,
    pedido: PedidoGuiasParcelamento,
  ): Promise<Result<GuiaParcelamentoDto[], AppError>>;
  consultarAutorizacao(cnpj: string): Promise<Result<AutorizacaoDto, AppError>>;
}
