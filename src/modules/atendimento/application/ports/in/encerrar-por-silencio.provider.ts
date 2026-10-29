import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type SilencioEncerrado = { encerrados: number };

export interface EncerrarPorSilencioPort {
  execute(): Promise<Result<SilencioEncerrado, AppError>>;
}
