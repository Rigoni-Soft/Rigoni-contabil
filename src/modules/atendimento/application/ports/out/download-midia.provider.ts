import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type MidiaBaixada = { bytes: Uint8Array; mime: string; nome?: string };

// Mídia que o cliente mandou, buscada no provedor pelo id que ele deu (docs/contratos/mensageria.md).
// `ServicoExternoError` = falha transitória (o provedor reenvia o evento); `ValidationError` = a
// mídia não existe mais ou o provedor a recusou (não adianta tentar de novo).
export interface DownloadMidiaPort {
  baixar(idDaMidia: string): Promise<Result<MidiaBaixada, AppError>>;
}
