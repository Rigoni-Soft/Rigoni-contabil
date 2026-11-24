import type { DocumentoDisponivel } from "@/modules/atendimento/application/ports/in/obter-conversa.provider";
import type { TipoGuia } from "@/modules/atendimento/application/ports/out/guias-fiscais.provider";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type DocumentoParaEnviar = {
  tipo: DocumentoDisponivel["tipo"] | TipoGuia;
  numero: number | null;
};

export interface EnviarDocumentoAoClientePort {
  execute(input: {
    atendimentoId: string;
    documento: DocumentoParaEnviar;
  }): Promise<Result<void, AppError>>;
}
