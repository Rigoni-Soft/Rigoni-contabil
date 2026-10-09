// Porta própria (arquitetura.md, seção 3.11): o `main` adapta a porta IN RegistrarAcao do
// módulo auditoria a esta forma.
export type RegistrarAcaoAuditoria = {
  ator: string;
  setor: string;
  acao: string;
  alvo: string;
  resultado: "sucesso" | "falha";
};

export interface AuditoriaPort {
  // Best-effort, só pra "falha". O "sucesso" é auditado pelo próprio banco, na mesma transação
  // da Transferência (`transferir_atendimento`): não existe Transferência sem evento.
  registrar(input: RegistrarAcaoAuditoria): Promise<void>;
}
