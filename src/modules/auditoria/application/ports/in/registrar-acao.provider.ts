import type { RegistroAcaoDto } from "@/modules/auditoria/application/dtos/registro-acao.dto";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// Só ações que mudam estado são registradas — nunca leituras (testes.md, ticket #29).
export type RegistrarAcaoInput = {
  ator: string;
  setor: string;
  acao: string;
  alvo: string;
  resultado: "sucesso" | "falha" | "falha_compensacao";
};

export interface RegistrarAcaoPort {
  execute(input: RegistrarAcaoInput): Promise<Result<RegistroAcaoDto, AppError>>;
}
