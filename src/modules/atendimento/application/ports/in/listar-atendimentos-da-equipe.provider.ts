import type { AtendimentoVisto } from "@/modules/atendimento/application/ports/in/listar-meus-atendimentos.provider";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";
import type { SetorSlug } from "@/shared/kernel/setores";

export type AtendimentoDaEquipeVisto = AtendimentoVisto & { donoNome: string | null };

// Leitura de supervisão: os Atendimentos dos outros no Setor. Só Líder do Setor e Admin.
export interface ListarAtendimentosDaEquipePort {
  // Sem `setor`: o do próprio usuário (Admin não tem um e precisa informar).
  execute(input: { setor?: SetorSlug }): Promise<Result<AtendimentoDaEquipeVisto[], AppError>>;
}
