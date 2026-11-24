import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type GuiaDasParaEnvio = {
  competencia: string;
  vencimento: string;
  guia: { url: string; nomeArquivo: string };
  caminho: string;
};

export interface ObterGuiaDasParaEnvioPort {
  execute(clienteId: string, mes: string): Promise<Result<GuiaDasParaEnvio, AppError>>;
}
