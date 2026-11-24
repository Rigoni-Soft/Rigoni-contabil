import type { EtapaIdentificacao } from "@/modules/atendimento/application/dtos/sessao-identificacao.dto";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type SessaoAtendimento =
  | { etapa: EtapaIdentificacao; invalidos: number }
  | { etapa: "tipo_documento" }
  | { etapa: "alteracao"; modo: "alteracoes" | "ambos"; pagina: number; lista: string }
  | { etapa: "setor"; pagina: number; invalidos: number };

export interface SessaoAtendimentoPort {
  obter(telefone: string): Promise<Result<SessaoAtendimento | null, AppError>>;
  salvar(telefone: string, sessao: SessaoAtendimento): Promise<Result<void, AppError>>;
  limpar(telefone: string): Promise<Result<void, AppError>>;
}
