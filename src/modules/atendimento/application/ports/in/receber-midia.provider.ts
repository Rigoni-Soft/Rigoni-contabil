import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type MidiaRecebida = {
  telefone: string;
  idDaMensagem?: string;
  midia: { id: string; mime: string; nome?: string };
  legenda?: string;
};

export interface ReceberMidiaPort {
  execute(midia: MidiaRecebida): Promise<Result<void, AppError>>;
}
