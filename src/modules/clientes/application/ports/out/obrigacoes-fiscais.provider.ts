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

// `ignorar`: parcelas (AAAAMM) já entregues, que o provedor não precisa emitir de novo (cada
// emissão é cobrada). O regime escolhe o parcelamento ordinário do provedor (PARCSN ou PARCMEI).
export type PedidoGuiasParcelamento = {
  regime: RegimeParcelamento;
  ignorar: readonly string[];
};

export interface ObrigacoesFiscaisPort {
  buscarDas(cnpj: string): Promise<Result<GuiaDasDto, AppError>>;
  // Todas as guias de parcelamento que o provedor emite hoje para o CNPJ (atrasadas e a vencer),
  // uma por parcela: 0, 1 ou várias. Só dos parcelamentos da Receita (`origem = receita_federal`;
  // `pgfn` nunca chega aqui). O provedor não diz de qual parcelamento do Cliente é cada guia: quem
  // chama atribui depois de baixar. Sem guias não é erro (lista vazia); indisponibilidade é
  // `ServicoExternoError`, e sem autorização vigente, `ForbiddenError` (consultada só se falhar).
  buscarGuiasParcelamento(
    cnpj: string,
    pedido: PedidoGuiasParcelamento,
  ): Promise<Result<GuiaParcelamentoDto[], AppError>>;
  consultarAutorizacao(cnpj: string): Promise<Result<AutorizacaoDto, AppError>>;
}
