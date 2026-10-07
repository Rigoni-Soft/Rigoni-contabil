import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type TipoGuia = "das" | "parcelamento" | "cnd";

// PDF em base64, como o provedor fiscal devolve.
export type GuiaFiscal = { nomeArquivo: string; pdfBase64: string };

export interface GuiasFiscaisPort {
  // O CNPJ vem do cadastro do Cliente (nunca perguntado ao contato). Sem autorização vigente do
  // Cliente, devolve `ValidationError`; falha do provedor, `ServicoExternoError`.
  buscar(clienteId: string, tipo: TipoGuia): Promise<Result<GuiaFiscal, AppError>>;
}
