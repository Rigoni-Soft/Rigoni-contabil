// Aviso ao cliente que saiu da Fila: o Funcionário que o assumiu.
export function avisoDeVez(funcionarioNome: string | null): string {
  return funcionarioNome
    ? `Chegou a sua vez! ${funcionarioNome} vai te atender agora.`
    : "Chegou a sua vez! Um atendente vai te atender agora.";
}

// Aviso ao cliente de que o Funcionário encerrou o Atendimento.
export const AVISO_ENCERRAMENTO_AO_CLIENTE =
  "Seu atendimento foi encerrado. Se precisar, é só nos chamar de novo.";
