export type UsuarioDto = {
  id: string;
  nome: string;
  email: string;
  papel: string;
  setor: string;
  precisaTrocarSenha: boolean;
  // Desativado no banco, ban no Auth pendente: o Admin reprocessa (PR #75, ponto D).
  bloqueioPendente: boolean;
};
