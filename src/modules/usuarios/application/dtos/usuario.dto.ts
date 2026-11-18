export type UsuarioDto = {
  id: string;
  nome: string;
  email: string;
  papel: string;
  setor: string;
  precisaTrocarSenha: boolean;
  // Desativado no banco, ban no Auth pendente: o Admin reprocessa.
  bloqueioPendente: boolean;
  // ISO da última gravação da foto do avatar; null = sem foto (o cabeçalho usa como `?v=` do cache).
  avatarAtualizadoEm: string | null;
  // Só o Funcionário envia foto (Meu perfil mostra o envio só para ele).
  podePersonalizarAvatar: boolean;
};
