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
  // Best-effort, só pra "falha" e "falha_compensacao" (tentativas sem estado a
  // preservar). O "sucesso" é auditado pelo próprio banco, na mesma transação da
  // escrita (trigger): do cadastro (INSERT em `clientes`) e da edição do cadastro
  // operacional (`cliente_atividades_mensais`) — não existe estado sem evento.
  registrar(input: RegistrarAcaoAuditoria): Promise<void>;
}
