import { SEM_RESPONSAVEL_ID } from "@/shared/kernel/papeis";

// Tipo estrutural local (view burra, arquitetura.md §3.4).
export type Fatia = { id: string; rotulo: string; quantidade: number };

// Só tokens existentes (sem token novo); atenção = destructive, como no #36.
// A cor nunca é o único canal: toda fatia aparece na legenda com rótulo e número.
const COR_POR_ID: Record<string, { fundo: string; traco: string }> = {
  enviado: { fundo: "bg-primary", traco: "stroke-primary" },
  pendente: { fundo: "bg-destructive", traco: "stroke-destructive" },
  pronto: { fundo: "bg-success", traco: "stroke-success" },
  sem_movimento: { fundo: "bg-muted-foreground", traco: "stroke-muted-foreground" },
  interno: { fundo: "bg-muted-foreground", traco: "stroke-muted-foreground" },
  [SEM_RESPONSAVEL_ID]: { fundo: "bg-muted-foreground", traco: "stroke-muted-foreground" },
};
const COR_PADRAO = { fundo: "bg-primary", traco: "stroke-primary" };

export const corDaFatia = (id: string) => COR_POR_ID[id] ?? COR_PADRAO;
