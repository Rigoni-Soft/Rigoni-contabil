// A causa de uma falha de transporte numa Server Action (arquitetura.md §3.8): só `TypeError` (o fetch que não
// saiu) é de rede; o resto é erro do servidor.
export const mensagemDaFalha = (erro: unknown) =>
  erro instanceof TypeError
    ? "Sem conexão com o servidor. Verifique a internet e tente novamente."
    : "Erro inesperado no servidor. Tente novamente; se continuar, avise o suporte.";
