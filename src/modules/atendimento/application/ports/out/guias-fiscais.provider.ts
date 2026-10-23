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

export interface GuiasFiscaisPort {
  // O CNPJ vem do cadastro do Cliente (nunca perguntado ao contato). Sem autorização vigente do
  // Cliente, devolve `ForbiddenError`; falha do provedor, `ServicoExternoError`. DAS e CND; o
  // parcelamento entrega só a guia mais atrasada.
  buscar(clienteId: string, tipo: TipoGuia): Promise<Result<GuiaFiscal, AppError>>;
}
