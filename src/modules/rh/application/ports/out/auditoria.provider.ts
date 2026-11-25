export type RegistrarAcaoAuditoria = {
  ator: string;
  setor: string;
  acao: string;
  alvo: string;
  resultado: "sucesso" | "falha" | "falha_compensacao";
};

export interface AuditoriaPort {
  registrar(input: RegistrarAcaoAuditoria): Promise<void>;
}
