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
  // Best-effort: falha ao registrar não deve derrubar a operação principal.
  registrar(input: RegistrarAcaoAuditoria): Promise<void>;
}
