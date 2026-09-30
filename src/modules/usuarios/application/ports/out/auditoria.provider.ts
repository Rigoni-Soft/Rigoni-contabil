import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// Porta própria (arquitetura.md, seção 3.11: módulos não se importam): o `main`
// adapta a porta IN RegistrarAcao do módulo auditoria a esta forma.
export type RegistrarAcaoAuditoria = {
  ator: string;
  setor: string;
  acao: string;
  alvo: string;
  resultado: "sucesso" | "falha";
};

export interface AuditoriaPort {
  // Devolutiva técnica PR #61, ponto 2: devolve Result de verdade — quem chama
  // decide o que fazer com uma falha (o caso de uso do caminho de sucesso trata
  // como fatal e compensa; best-effort deixou de ser contrato da porta).
  registrar(input: RegistrarAcaoAuditoria): Promise<Result<void, AppError>>;
}
