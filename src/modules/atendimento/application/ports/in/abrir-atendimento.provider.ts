import type { NovaMensagem } from "@/modules/atendimento/application/ports/out/atendimento.repository";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type AberturaAtendimento = {
  telefone: string;
  clienteId: string | null;
  setor: string;
  mensagens: NovaMensagem[];
};

export interface AbrirAtendimentoPort {
  // `funcionarioId` null = nenhum Funcionário livre no Setor (a Fila é do #45).
  execute(
    abertura: AberturaAtendimento,
  ): Promise<Result<{ id: string; funcionarioId: string | null }, AppError>>;
}
