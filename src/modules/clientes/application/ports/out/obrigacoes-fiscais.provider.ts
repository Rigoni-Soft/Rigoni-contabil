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
  // Opcionais: nem todo provedor informa fora do PDF.
  valorCentavos?: number;
  vencimento?: string; // AAAA-MM-DD
};

// O Cliente autorizou o escritório a consultar os dados dele? O sistema só
// reflete esse estado, nunca o concede.
export type AutorizacaoDto = { vigente: true; dataExpiracao: string } | { vigente: false }; // AAAA-MM-DD

// Regimes com parcelamento ordinário (PARC): cada um tem o seu no provedor.
export type RegimeParcelamento = "simples_nacional" | "mei";

// Guia por parcelamento, só da Receita (`origem = receita_federal`): `pgfn` nunca chega aqui.
// `codigo` é o rótulo do parcelamento no nosso sistema, não um número que o provedor conheça.
// `emAbertoDaReceita`: quantos parcelamentos da Receita em aberto o Cliente tem (o banco sabe, o
// provedor não); com mais de um, uma guia só pela parcela não se atribui a um deles.
export type PedidoGuiaParcelamento = {
  codigo: string;
  regime: RegimeParcelamento;
  emAbertoDaReceita: number;
};

export interface ObrigacoesFiscaisPort {
  buscarDas(cnpj: string): Promise<Result<GuiaDasDto, AppError>>;
  // Erro de `GuiaParcelamentoIndisponivelError` por motivo; indisponibilidade, `ServicoExternoError`;
  // sem autorização vigente, `ForbiddenError` (consultada só depois que a guia falha).
  buscarGuiaParcelamento(
    cnpj: string,
    pedido: PedidoGuiaParcelamento,
  ): Promise<Result<GuiaParcelamentoDto, AppError>>;
  consultarAutorizacao(cnpj: string): Promise<Result<AutorizacaoDto, AppError>>;
}
