import type { AtendimentoVisto } from "@/modules/atendimento/application/ports/in/listar-meus-atendimentos.provider";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";
import type { SetorSlug } from "@/shared/kernel/setores";

export type AtendimentoDaEquipeVisto = AtendimentoVisto & { donoNome: string | null };

export interface ListarAtendimentosDaEquipePort {
  execute(input: { setor: SetorSlug }): Promise<Result<AtendimentoDaEquipeVisto[], AppError>>;
}
