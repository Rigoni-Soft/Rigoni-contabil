import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type RemoverDestinoDeEnvioInput = { destinoId: string };

export interface RemoverDestinoDeEnvioPort {
  execute(input: RemoverDestinoDeEnvioInput): Promise<Result<void, AppError>>;
}
