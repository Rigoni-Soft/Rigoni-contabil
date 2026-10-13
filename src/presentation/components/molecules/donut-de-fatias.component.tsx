import { CartaoDeGrafico } from "@/presentation/components/atoms/cartao-de-grafico.component";
import { DonutSvg } from "@/presentation/components/atoms/donut-svg.component";
import { LegendaDeFatia } from "@/presentation/components/atoms/legenda-de-fatia.component";
import type { Fatia } from "@/presentation/lib/fatia-de-grafico";

// Donut de fatias com o total no centro e a legenda (rótulo + número) ao lado.
export function DonutDeFatias({ titulo, fatias }: { titulo: string; fatias: Fatia[] }) {
  return (
    <CartaoDeGrafico titulo={titulo}>
      <div className="flex items-center gap-4">
        <DonutSvg fatias={fatias} />
        <ul className="min-w-0 flex-1 space-y-1">
          {fatias.map((f) => (
            <LegendaDeFatia key={f.id} fatia={f} />
          ))}
        </ul>
      </div>
    </CartaoDeGrafico>
  );
}
