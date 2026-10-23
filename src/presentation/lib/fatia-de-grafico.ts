import { corDeStatus } from "@/presentation/lib/cor-de-status";
import { SEM_RESPONSAVEL_ID } from "@/shared/kernel/papeis";

// Tipo estrutural local (view burra, arquitetura.md §3.4).
// `cor` (escala dos cards) tem precedência sobre a cor do id.
export type Fatia = { id: string; rotulo: string; quantidade: number; cor?: string };

// DAS e parcelamento trazem `cor` (escala dos cards). Sem ela, a fatia usa a cor do id: só o "Sem
// responsável" é neutro; o resto (atividade, Responsáveis) é primary. Só tokens existentes.
const COR_POR_ID: Record<string, { fundo: string; traco: string }> = {
  [SEM_RESPONSAVEL_ID]: { fundo: "bg-muted-foreground", traco: "stroke-muted-foreground" },
};
const COR_PADRAO = { fundo: "bg-primary", traco: "stroke-primary" };

export const corDaFatia = ({ id, cor }: Fatia) =>
  cor ? corDeStatus(cor) : (COR_POR_ID[id] ?? COR_PADRAO);
