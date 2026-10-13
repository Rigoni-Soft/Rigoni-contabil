import { cn } from "@/presentation/lib/utils";

// Papéis tipográficos do produto (DESIGN.md → Tipografia): a cor e o peso saem do papel, não da tela.
// Trecho sem papel (só layout) é `Caixa`, não `Texto`.
const VARIANTES = {
  destaque: "font-medium text-foreground",
  corpo: "text-sm text-foreground",
  apoio: "text-sm text-muted-foreground",
  alerta: "text-sm text-destructive",
  rotulo: "text-xs font-semibold",
  nota: "text-xs text-muted-foreground",
  titulo: "font-semibold text-foreground",
  subtitulo: "text-lg font-semibold text-foreground",
  tela: "text-xl font-bold tracking-tight text-primary",
  subtela: "text-lg font-bold tracking-tight text-primary",
  marca: "text-2xl font-bold tracking-tight text-primary",
  secao: "text-sm font-bold tracking-wide text-foreground uppercase",
  rotuloDeSecao: "text-sm font-semibold tracking-wide text-muted-foreground uppercase",
  enfase: "font-bold",
  codigo: "rounded-md bg-muted px-3 py-2 font-mono text-lg tracking-wider",
  somenteLeitor: "sr-only",
  ocultoNoCelular: "hidden sm:inline",
} as const;

type TextoProps = Omit<React.HTMLAttributes<HTMLElement>, "className"> & {
  variante: keyof typeof VARIANTES;
  // Elemento semântico; o padrão é parágrafo.
  como?: "p" | "span" | "h1" | "h2" | "h3" | "strong" | "small";
  className?: string;
  ref?: React.Ref<HTMLElement>;
};

export function Texto({ variante, como = "p", className, children, ...props }: TextoProps) {
  const Elemento = como as React.ElementType<
    React.HTMLAttributes<HTMLElement> & { ref?: React.Ref<HTMLElement> }
  >;
  return (
    <Elemento className={cn(VARIANTES[variante], className)} {...props}>
      {children}
    </Elemento>
  );
}
