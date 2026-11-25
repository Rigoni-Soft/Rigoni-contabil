export const mensagemDaFalha = (erro: unknown) =>
  erro instanceof TypeError
    ? "Sem conexão com o servidor. Verifique a internet e tente novamente."
    : "Erro inesperado no servidor. Tente novamente; se continuar, avise o suporte.";
