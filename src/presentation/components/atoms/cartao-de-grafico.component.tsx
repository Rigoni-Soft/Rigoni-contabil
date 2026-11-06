import { cn } from "@/presentation/lib/utils";

type CartaoDeGraficoProps = {
  titulo: string;
  className?: string;
  children: React.ReactNode;
};

// Moldura de um comparativo: grupo nomeado pelo título, com o conteúdo do gráfico dentro.
export function CartaoDeGrafico({ titulo, className, children }: CartaoDeGraficoProps) {
  return (
    <div
      role="group"
      aria-label={titulo}
      className={cn("space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm", className)}
    >
      <p className="text-sm font-bold tracking-wide text-foreground uppercase">{titulo}</p>
      {children}
    </div>
  );
}
