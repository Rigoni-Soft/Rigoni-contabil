import type { DocumentoDisponivel } from "@/modules/atendimento/application/ports/in/obter-conversa.provider";
import type { TipoGuia } from "@/modules/atendimento/application/ports/out/guias-fiscais.provider";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// O que o painel dispara: contrato, alteração (por `numero`) ou guia/CND (`numero` nulo).
export type DocumentoParaEnviar = {
  tipo: DocumentoDisponivel["tipo"] | TipoGuia;
  numero: number | null;
};

// Dispara o mesmo serviço do menu da URA (contrato social, alterações, guias e CND), usando o
// Cliente já vinculado ao Atendimento.
export interface EnviarDocumentoAoClientePort {
  execute(input: {
    atendimentoId: string;
    documento: DocumentoParaEnviar;
  }): Promise<Result<void, AppError>>;
}
