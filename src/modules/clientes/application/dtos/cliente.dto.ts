export type AlteracaoContratualDto = { data: string; arquivoCaminho: string };

export type ClienteDto = {
  id: string;
  empresa: string;
  cnpj: string;
  regime: string;
  contratoSocialCaminho: string;
  alteracoesContratuais: AlteracaoContratualDto[];
};
