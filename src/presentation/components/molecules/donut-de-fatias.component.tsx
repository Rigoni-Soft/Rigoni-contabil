import { Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import { CartaoDeGrafico } from "@/presentation/components/atoms/cartao-de-grafico.component";
import { DonutSvg } from "@/presentation/components/atoms/donut-svg.component";
import { LegendaDeFatia } from "@/presentation/components/atoms/legenda-de-fatia.component";
import type { Fatia } from "@/presentation/lib/fatia-de-grafico";

// Donut de fatias com o total no centro e a legenda (rótulo + número) ao lado.
export function DonutDeFatias({ titulo, fatias }: { titulo: string; fatias: Fatia[] }) {
  return (
    <CartaoDeGrafico titulo={titulo}>
      <Linha alinhar="centro" espaco={4}>
        <DonutSvg fatias={fatias} />
        <Pilha espaco={1} como="ul" className="min-w-0 flex-1">
          {fatias.map((f) => (
            <LegendaDeFatia key={f.id} fatia={f} />
          ))}
        </Pilha>
      </Linha>
    </CartaoDeGrafico>
  );
}
