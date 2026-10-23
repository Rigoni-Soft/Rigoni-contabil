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
};

// Qual parcelamento (da Receita; `pgfn` nunca chega ao provedor fiscal) a guia deve atender, e
// quantos da Receita o Cliente tem em aberto: o provedor não sabe, e com mais de um não atribui a guia.
export type ParcelamentoDaGuia = { codigo: string; emAbertoDaReceita: number };

export interface GuiasFiscaisPort {
  // O CNPJ vem do cadastro do Cliente (nunca perguntado ao contato). Sem autorização vigente do
  // Cliente, devolve `ForbiddenError`; falha do provedor, `ServicoExternoError`. O tipo
  // `parcelamento` exige `parcelamento` e pode devolver `GuiaParcelamentoIndisponivelError`
  // (por motivo); a autorização dele só é consultada se a guia falhar, dentro do provedor.
  buscar(
    clienteId: string,
    tipo: TipoGuia,
    parcelamento?: ParcelamentoDaGuia,
  ): Promise<Result<GuiaFiscal, AppError>>;
}
