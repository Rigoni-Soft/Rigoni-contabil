import { cn } from "@/presentation/lib/utils";

// Papéis tipográficos do produto (DESIGN.md → Tipografia): a cor e o peso saem do papel, não da tela.
// `livre` não define estilo: o texto herda o do contêiner e a classe vem de quem usa.
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
  livre: "",
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
