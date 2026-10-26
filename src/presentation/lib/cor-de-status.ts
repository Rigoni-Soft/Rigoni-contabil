// Escala semântica única do dashboard: o anel do card e a barra/fatia do comparativo usam a mesma
// tinta para o mesmo status. Só tokens existentes. A cor nunca é o único canal: todo status aparece
// com rótulo e número. `em_dia` e `andamento` compartilham a tinta por decisão do DESIGN.md.
const COR_DE_STATUS: Record<string, { traco: string; fundo: string }> = {
  em_dia: { traco: "stroke-primary", fundo: "bg-primary" },
  atencao: { traco: "stroke-success", fundo: "bg-success" },
  urgente: { traco: "stroke-destructive", fundo: "bg-destructive" },
  informativo: { traco: "stroke-muted-foreground", fundo: "bg-muted-foreground" },
  andamento: { traco: "stroke-primary", fundo: "bg-primary" },
};

export const corDeStatus = (cor: string) => COR_DE_STATUS[cor] ?? COR_DE_STATUS.informativo;
