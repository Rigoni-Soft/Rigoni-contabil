// Item de lista com conteúdo à esquerda e ações à direita.
export function LinhaDeLista({ children }: { children: React.ReactNode }) {
  return <li className="flex items-center justify-between gap-4 px-4 py-3">{children}</li>;
}
