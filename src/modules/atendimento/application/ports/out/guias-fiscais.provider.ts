import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type TipoGuia = "das" | "parcelamento" | "cnd";

// PDF em base64, como o provedor fiscal devolve. `competencia` (AAAA-MM) e `vencimento`
// (AAAA-MM-DD) vêm na guia do DAS; `parcela` (AAAAMM) e `vencimento`, na do parcelamento. Os jobs
// precisam deles para o template.
export type GuiaFiscal = {
  nomeArquivo: string;
  pdfBase64: string;
  competencia?: string;
  vencimento?: string;
  parcela?: string;
  valorCentavos?: number; // guia de parcelamento: o consumidor atribui a guia pelo valor
};

export interface GuiasFiscaisPort {
  // O CNPJ vem do cadastro do Cliente (nunca perguntado ao contato). Sem autorização vigente do
  // Cliente, devolve `ForbiddenError`; falha do provedor, `ServicoExternoError`. DAS e CND; o
  // parcelamento: `GuiasParcelamentoFiscaisPort`.
  buscar(clienteId: string, tipo: TipoGuia): Promise<Result<GuiaFiscal, AppError>>;
}

// O parcelamento tem várias guias por Cliente, então não cabe em `buscar`.
export interface GuiasParcelamentoFiscaisPort {
  // Todas as guias de parcelamento da Receita que o provedor emite hoje para o Cliente, uma por
  // parcela (0, 1 ou várias), menos as parcelas (AAAAMM) já entregues, que não são emitidas (nem
  // cobradas) de novo. O provedor não diz de qual parcelamento é cada guia: quem chama atribui
  // depois de baixar, e roteia o interno ao financeiro. Sem autorização, `ForbiddenError`, só
  // consultada se a emissão falhar.
  buscarGuiasParcelamento(
    clienteId: string,
    ignorar: readonly string[],
  ): Promise<Result<GuiaFiscal[], AppError>>;
}
