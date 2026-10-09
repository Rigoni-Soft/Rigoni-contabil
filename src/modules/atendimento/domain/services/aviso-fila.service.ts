// Aviso ao cliente que saiu da Fila: o Funcionário que o assumiu.
export function avisoDeVez(funcionarioNome: string | null): string {
  return funcionarioNome
    ? `Chegou a sua vez! ${funcionarioNome} vai te atender agora.`
    : "Chegou a sua vez! Um atendente vai te atender agora.";
}
