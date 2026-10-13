import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// Feriados estaduais/municipais cadastrados pelo Admin, como datas "AAAA-MM-DD" (os nacionais
// estão no domínio).
export interface FeriadosPort {
  listarDatas(): Promise<Result<string[], AppError>>;
}
