import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// Só a posição do cliente no menu. Nunca nome, empresa, CNPJ, caminho de arquivo ou
// qualquer dado do Cliente: o que for preciso é recalculado a cada mensagem. `lista` é um hash
// da lista de alterações exibida, só para detectar que ela mudou antes de a escolha valer.
export const ETAPAS_IDENTIFICACAO = ["ja_cliente", "cnpj", "cnpj_nova_tentativa"] as const;
export type EtapaIdentificacao = (typeof ETAPAS_IDENTIFICACAO)[number];

export type SessaoAtendimento =
  | { etapa: EtapaIdentificacao; invalidos: number }
  | { etapa: "tipo_documento" }
  | { etapa: "alteracao"; modo: "alteracoes" | "ambos"; pagina: number; lista: string };

// Só as etapas da identificação contam respostas inválidas; as demais valem 0.
export function invalidosDe(sessao: SessaoAtendimento | null): number {
  return sessao && "invalidos" in sessao ? sessao.invalidos : 0;
}

export interface SessaoAtendimentoPort {
  // `telefone` só com dígitos, sem DDI. Sessão expirada conta como inexistente (null).
  obter(telefone: string): Promise<Result<SessaoAtendimento | null, AppError>>;
  salvar(telefone: string, sessao: SessaoAtendimento): Promise<Result<void, AppError>>;
  limpar(telefone: string): Promise<Result<void, AppError>>;
}
