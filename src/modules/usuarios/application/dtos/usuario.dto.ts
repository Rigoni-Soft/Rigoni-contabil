export type UsuarioDto = {
  id: string;
  nome: string;
  email: string;
  papel: string;
  setor: string;
  precisaTrocarSenha: boolean;
  desativacaoPendente: boolean;
  avatarAtualizadoEm: string | null;
};
