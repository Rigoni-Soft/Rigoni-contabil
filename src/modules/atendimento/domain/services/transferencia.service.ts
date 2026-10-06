import type { Papel } from "@/shared/kernel/papeis";
import type { SetorSlug } from "@/shared/kernel/setores";

// Quem transfere: o Funcionário dono do Atendimento, o Líder do Setor onde ele está, ou o Admin.
export function podeTransferir(
  ator: { id: string; papel: Papel; setor: SetorSlug },
  atendimento: { setor: SetorSlug; funcionarioId: string | null },
): boolean {
  return (
    ator.papel === "admin" ||
    (ator.papel === "lider_setor" && ator.setor === atendimento.setor) ||
    ator.id === atendimento.funcionarioId
  );
}

// Só Cliente do Simples Nacional ou MEI é atendido (e transferido) pelo setor Simples Nacional.
export function atendidoPeloSimplesNacional(regime: string): boolean {
  return regime === "simples_nacional" || regime === "mei";
}
