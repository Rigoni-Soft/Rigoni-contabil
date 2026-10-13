import { CartaoDeGrafico } from "@/presentation/components/atoms/cartao-de-grafico.component";
import { corDaFatia, type Fatia } from "@/presentation/lib/fatia-de-grafico";

type BarrasDeFatiasProps = {
  titulo: string;
  fatias: Fatia[];
  totalClientes: number;
  nota: string;
  className?: string;
};

// Barras horizontais proporcionais ao total de clientes, com rótulo e número em cada linha.
export function BarrasDeFatias({
  titulo,
  fatias,
  totalClientes,
  nota,
  className,
}: BarrasDeFatiasProps) {
  return (
    <CartaoDeGrafico titulo={titulo} className={className}>
      {fatias.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum cliente atribuído ainda.</p>
      )}
      <ul className="space-y-3">
        {fatias.map((f) => {
          const pct = totalClientes === 0 ? 0 : Math.min(100, (f.quantidade / totalClientes) * 100);
          return (
            <li key={f.id} className="space-y-1">
              <div className="flex gap-2 text-sm">
                <span className="truncate text-foreground" title={f.rotulo}>
                  {f.rotulo}
                </span>
                <span className="ml-auto shrink-0 font-semibold text-foreground tabular-nums">
                  {f.quantidade}
                </span>
              </div>
              <div aria-hidden className="h-2 rounded-full bg-border">
                <div
                  className={`h-2 rounded-full ${corDaFatia(f.id).fundo}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground">{nota}</p>
    </CartaoDeGrafico>
  );
}
