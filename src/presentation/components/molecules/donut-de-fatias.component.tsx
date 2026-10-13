import { CartaoDeGrafico } from "@/presentation/components/atoms/cartao-de-grafico.component";
import { corDaFatia, type Fatia } from "@/presentation/lib/fatia-de-grafico";

const RAIO = 40;
const CIRCUNFERENCIA = 2 * Math.PI * RAIO;

function Legenda({ fatias }: { fatias: Fatia[] }) {
  return (
    <ul className="space-y-1 text-sm">
      {fatias.map((f) => (
        <li key={f.id} className="flex items-center gap-2">
          <span aria-hidden className={`size-3 shrink-0 rounded-sm ${corDaFatia(f.id).fundo}`} />
          <span className="text-foreground">{f.rotulo}</span>
          <span className="ml-auto font-semibold text-foreground tabular-nums">{f.quantidade}</span>
        </li>
      ))}
    </ul>
  );
}

// Donut de fatias com o total no centro e a legenda (rótulo + número) ao lado.
export function DonutDeFatias({ titulo, fatias }: { titulo: string; fatias: Fatia[] }) {
  const total = fatias.reduce((soma, f) => soma + f.quantidade, 0);
  return (
    <CartaoDeGrafico titulo={titulo}>
      <div className="flex items-center gap-4">
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
                    className={`fill-none ${corDaFatia(f.id).traco}`}
                  />
                );
              })}
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xl font-bold text-foreground tabular-nums">{total}</span>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <Legenda fatias={fatias} />
        </div>
      </div>
    </CartaoDeGrafico>
  );
}
