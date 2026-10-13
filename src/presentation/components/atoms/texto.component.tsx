import { cn } from "@/presentation/lib/utils";

// Papéis tipográficos do produto (DESIGN.md → Tipografia): a cor e o peso saem do papel, não da tela.
const VARIANTES = {
  destaque: "font-medium text-foreground",
  corpo: "text-sm text-foreground",
  apoio: "text-sm text-muted-foreground",
  alerta: "text-sm text-destructive",
  rotulo: "text-xs font-semibold",
  nota: "text-xs text-muted-foreground",
  titulo: "font-semibold text-foreground",
  tela: "text-xl font-bold tracking-tight text-primary",
  secao: "text-sm font-bold tracking-wide text-foreground uppercase",
} as const;

type TextoProps = {
  variante: keyof typeof VARIANTES;
  // Elemento semântico; o padrão é parágrafo.
  como?: "p" | "span" | "h1" | "h2";
  className?: string;
  children: React.ReactNode;
};

export function Texto({ variante, como: Elemento = "p", className, children }: TextoProps) {
  return <Elemento className={cn(VARIANTES[variante], className)}>{children}</Elemento>;
}
