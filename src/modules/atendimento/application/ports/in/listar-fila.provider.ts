import type { DadosDoContato } from "@/modules/atendimento/application/ports/in/transferir-atendimento.provider";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";
import type { SetorSlug } from "@/shared/kernel/setores";

export type ItemDaFilaVisto = {
  atendimentoId: string;
  telefone: string;
  contato: DadosDoContato;
  resumo: string | null;
  origem: { setor: SetorSlug; nome: string | null } | null;
  filaDesde: Date;
  espera: string;
  filaDoFuncionarioId: string | null;
  esperaComum: boolean;
};

export interface ListarFilaPort {
  execute(input: { setor?: SetorSlug }): Promise<Result<ItemDaFilaVisto[], AppError>>;
}
