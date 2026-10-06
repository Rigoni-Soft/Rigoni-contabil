// Quem transfere: o Funcionário dono do Atendimento, o Líder do Setor onde ele está, ou o Admin.
export function podeTransferir(
  ator: { id: string; papel: string; setor: string },
  atendimento: { setor: string; funcionarioId: string | null },
): boolean {
  return (
    ator.papel === "admin" ||
    (ator.papel === "lider_setor" && ator.setor === atendimento.setor) ||
    ator.id === atendimento.funcionarioId
  );
}
