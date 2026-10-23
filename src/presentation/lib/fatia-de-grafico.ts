import { corDeStatus } from "@/presentation/lib/cor-de-status";

// Tipo estrutural local (view burra, arquitetura.md §3.4). `cor` é a escala semântica dos cards; a
// fatia sem ela usa a tinta de "em dia".
export type Fatia = { id: string; rotulo: string; quantidade: number; cor?: string };

export const corDaFatia = ({ cor }: Fatia) => corDeStatus(cor ?? "em_dia");
