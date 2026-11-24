import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type MidiaBaixada = { bytes: Uint8Array; mime: string; nome?: string };

export interface DownloadMidiaPort {
  baixar(idDaMidia: string): Promise<Result<MidiaBaixada, AppError>>;
}
