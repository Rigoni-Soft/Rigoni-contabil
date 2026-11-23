import type { Papel } from "@/shared/kernel/papeis";
import type { SetorSlug } from "@/shared/kernel/setores";

type Ator = { id: string; papel: Papel; setor: SetorSlug };
type AtendimentoDoSetor = { setor: SetorSlug; funcionarioId: string | null };

// E-mail opcional do Contato: em branco vira null; senão aparado e em minúsculas (como o banco grava).
// `undefined` = e-mail digitado que não parece um e-mail.
export function normalizarEmailDoContato(entrada: string | null): string | null | undefined {
  const email = (entrada ?? "").trim().toLowerCase();
  if (email === "") return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined;
}

// Quem cadastra o número como Contato URA do Cliente: só a Recepção, e só o dono do Atendimento
// dela (quem responde o cliente). Líder e Admin em supervisão não cadastram. O banco confere de novo.
export function podeCadastrarContatoUra(ator: Ator, atendimento: AtendimentoDoSetor): boolean {
  return (
    ator.setor === "recepcao" &&
    atendimento.setor === "recepcao" &&
    ator.id === atendimento.funcionarioId
  );
}
