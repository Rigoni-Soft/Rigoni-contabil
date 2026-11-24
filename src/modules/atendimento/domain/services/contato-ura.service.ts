import type { Papel } from "@/shared/kernel/papeis";
import type { SetorSlug } from "@/shared/kernel/setores";

type Ator = { id: string; papel: Papel; setor: SetorSlug };
type AtendimentoDoSetor = { setor: SetorSlug; funcionarioId: string | null };

export function normalizarEmailDoContato(entrada: string | null): string | null | undefined {
  const email = (entrada ?? "").trim().toLowerCase();
  if (email === "") return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined;
}

export function podeCadastrarContatoUra(ator: Ator, atendimento: AtendimentoDoSetor): boolean {
  return (
    ator.setor === "recepcao" &&
    atendimento.setor === "recepcao" &&
    ator.id === atendimento.funcionarioId
  );
}
