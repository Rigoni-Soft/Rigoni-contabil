export type AlteracaoContratualDto = { numero: number; data: string; arquivoCaminho: string };

export type ClienteDto = {
  id: string;
  empresa: string;
  cnpj: string;
  regime: string;
  contratoSocialCaminho: string | null;
  email: string | null;
  alteracoesContratuais: AlteracaoContratualDto[];
};
