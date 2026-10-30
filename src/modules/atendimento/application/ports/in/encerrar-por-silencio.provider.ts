import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// `falhas` é sempre 0: o encerramento é uma RPC só, e a falha dela volta como erro (502).
export type SilencioEncerrado = { encerrados: number; falhas: 0 };

export interface EncerrarPorSilencioPort {
  execute(): Promise<Result<SilencioEncerrado, AppError>>;
}
