import type { ArquivoAnexo } from "@/modules/atendimento/application/ports/out/anexos-atendimento.provider";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type EntradaEnviarAnexo = {
  atendimentoId: string;
  legenda?: string;
} & ({ arquivo: ArquivoAnexo } | { guardado: { caminho: string; nome: string } }) & {
    miniatura?: ArquivoAnexo;
  };

export interface EnviarAnexoAoClientePort {
  execute(input: EntradaEnviarAnexo): Promise<Result<void, AppError>>;
}
