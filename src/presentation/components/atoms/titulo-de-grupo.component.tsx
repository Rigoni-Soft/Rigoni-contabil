export function TituloDoGrupo({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
      {children}
    </h2>
  );
}
