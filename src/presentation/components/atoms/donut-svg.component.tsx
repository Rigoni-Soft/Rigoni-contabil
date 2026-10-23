import { corDaFatia, type Fatia } from "@/presentation/lib/fatia-de-grafico";

const RAIO = 40;
const CIRCUNFERENCIA = 2 * Math.PI * RAIO;

// Donut de fatias com o total no centro. Decorativo: a legenda traz rótulo e número.
export function DonutSvg({ fatias }: { fatias: Fatia[] }) {
  const total = fatias.reduce((soma, f) => soma + f.quantidade, 0);
  return (
    <div className="relative size-28 shrink-0">
      <svg viewBox="0 0 100 100" aria-hidden className="size-28 -rotate-90">
        <circle cx="50" cy="50" r={RAIO} strokeWidth="14" className="fill-none stroke-border" />
        {fatias
          .filter((f) => f.quantidade > 0)
          .map((f, i, visiveis) => {
            const comprimento = (f.quantidade / total) * CIRCUNFERENCIA;
            const offset = -visiveis
              .slice(0, i)
              .reduce((soma, v) => soma + (v.quantidade / total) * CIRCUNFERENCIA, 0);
            return (
              <circle
                key={f.id}
                cx="50"
                cy="50"
                r={RAIO}
                strokeWidth="14"
                strokeDasharray={`${comprimento} ${CIRCUNFERENCIA - comprimento}`}
                strokeDashoffset={offset}
                className={`fill-none ${corDaFatia(f).traco}`}
              />
            );
          })}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xl font-bold text-foreground tabular-nums">{total}</span>
      </div>
    </div>
  );
}
