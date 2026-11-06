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
  // Best-effort. Na Transferência só a "falha" passa por aqui: o "sucesso" é auditado pelo banco,
  // na mesma transação (`transferir_atendimento`): não existe Transferência sem evento. Nas ações
  // sem RPC própria (envio de documento) vão as duas.
  registrar(input: RegistrarAcaoAuditoria): Promise<void>;
}
