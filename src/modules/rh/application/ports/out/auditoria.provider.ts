// Porta própria: o `main` adapta a porta IN RegistrarAcao do módulo auditoria a esta forma.
export type RegistrarAcaoAuditoria = {
  ator: string;
  setor: string;
  acao: string;
  alvo: string;
  resultado: "sucesso" | "falha" | "falha_compensacao";
};

export interface AuditoriaPort {
  // Best-effort, só para "falha": o "sucesso" nasce no banco, por gatilho, na mesma transação da escrita.
  registrar(input: RegistrarAcaoAuditoria): Promise<void>;
}
