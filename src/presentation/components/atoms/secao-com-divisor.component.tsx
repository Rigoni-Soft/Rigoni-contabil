// Bloco separado do anterior por uma linha (painéis laterais com seções empilhadas).
export function SecaoComDivisor({ children }: { children: React.ReactNode }) {
  return <div className="border-t border-border pt-3">{children}</div>;
}
