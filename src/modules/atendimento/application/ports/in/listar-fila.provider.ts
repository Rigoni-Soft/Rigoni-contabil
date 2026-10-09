import type { DadosDoContato } from "@/modules/atendimento/application/ports/in/transferir-atendimento.provider";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";
import type { SetorSlug } from "@/shared/kernel/setores";

// `posicao` 1 = o próximo a sair; `filaDesde` + `espera` (mm:ss, h:mm:ss a partir de 1h) é o que o
// Setor vê. `filaDoFuncionarioId` null = fila do Setor; senão é a fila de um usuário.
export type ItemDaFilaVisto = {
  atendimentoId: string;
  posicao: number;
  telefone: string;
  contato: DadosDoContato;
  resumo: string | null;
  filaDesde: Date;
  espera: string;
  filaDoFuncionarioId: string | null;
};

export interface ListarFilaPort {
  execute(input: { setor: SetorSlug }): Promise<Result<ItemDaFilaVisto[], AppError>>;
}
