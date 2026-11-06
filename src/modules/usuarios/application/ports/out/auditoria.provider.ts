import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// Porta própria (arquitetura.md, seção 3.11: módulos não se importam): o `main`
// adapta a porta IN RegistrarAcao do módulo auditoria a esta forma.
export type RegistrarAcaoAuditoria = {
  ator: string;
  setor: string;
  acao: string;
  alvo: string;
  resultado: "sucesso" | "falha" | "falha_compensacao";
};

export interface AuditoriaPort {
  // Devolve Result de verdade: quem chama decide o que fazer com a falha (o caso
  // de uso do caminho de sucesso trata como fatal e compensa).
  registrar(input: RegistrarAcaoAuditoria): Promise<Result<void, AppError>>;
}
