import type { DadosDoContato } from "@/modules/atendimento/application/ports/in/transferir-atendimento.provider";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";
import type { SetorSlug } from "@/shared/kernel/setores";

// `filaDesde` + `espera` (mm:ss, h:mm:ss a partir de 1h) é o que o Setor vê.
// `filaDoFuncionarioId` null = espera do Setor; senão está dirigido a um usuário.
export type ItemDaFilaVisto = {
  atendimentoId: string;
  telefone: string;
  contato: DadosDoContato;
  resumo: string | null;
  filaDesde: Date;
  espera: string;
  filaDoFuncionarioId: string | null;
};

export interface ListarFilaPort {
  // Sem `setor`: a Fila do Setor do próprio usuário (Admin não tem um e precisa informar).
  execute(input: { setor?: SetorSlug }): Promise<Result<ItemDaFilaVisto[], AppError>>;
}
