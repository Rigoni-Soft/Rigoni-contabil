// Ações lado a lado de uma linha de lista (cada uma costuma ser um Container pequeno por slot).
export function GrupoDeAcoes({ children }: { children: React.ReactNode }) {
  return <div className="flex items-start gap-2">{children}</div>;
}
