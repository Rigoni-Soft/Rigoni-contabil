import type { PdfDoCartaoDto } from "@/modules/rh/application/dtos/documento-do-cartao.dto";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// Um PDF por empregado e mês ("AAAA-MM"): a competência é obrigatória.
export type BaixarPdfDoCartaoInput = {
  clienteId: string;
  empregadoId: string;
  competencia: string;
};

export interface BaixarPdfDoCartaoPort {
  execute(input: BaixarPdfDoCartaoInput): Promise<Result<PdfDoCartaoDto, AppError>>;
}
