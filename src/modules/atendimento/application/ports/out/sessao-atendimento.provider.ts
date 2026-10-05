import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// Só a posição do cliente no menu. Nunca nome, empresa, CNPJ, caminho de arquivo ou
// qualquer dado do Cliente: o que for preciso é recalculado a cada mensagem.
export type SessaoAtendimento =
  | { etapa: "ja_cliente" }
  | { etapa: "cnpj" }
  | { etapa: "tipo_documento" }
  | { etapa: "alteracao"; modo: "alteracoes" | "ambos"; pagina: number };

export interface SessaoAtendimentoPort {
  // `telefone` só com dígitos, sem DDI. Sessão expirada conta como inexistente (null).
  obter(telefone: string): Promise<Result<SessaoAtendimento | null, AppError>>;
  salvar(telefone: string, sessao: SessaoAtendimento): Promise<Result<void, AppError>>;
  limpar(telefone: string): Promise<Result<void, AppError>>;
}
