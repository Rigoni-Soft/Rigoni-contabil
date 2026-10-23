import { Caixa, Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import { CartaoDeGrafico } from "@/presentation/components/atoms/cartao-de-grafico.component";
import { DonutSvg } from "@/presentation/components/atoms/donut-svg.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { corDeStatus } from "@/presentation/lib/cor-de-status";
import type { Fatia } from "@/presentation/lib/fatia-de-grafico";
import { cn } from "@/presentation/lib/utils";

// Donut de fatias com o total no centro e a legenda (cor + rótulo + número) ao lado. A cor nunca é
// o único canal: toda fatia aparece na legenda com rótulo e quantidade.
export function DonutDeFatias({ titulo, fatias }: { titulo: string; fatias: Fatia[] }) {
  return (
    <CartaoDeGrafico titulo={titulo}>
      <Linha alinhar="centro" espaco={4}>
        <DonutSvg fatias={fatias} />
        <Pilha como="ul" espaco={1} className="min-w-0 flex-1">
          {fatias.map((f) => (
            <Linha como="li" key={f.id} alinhar="centro" espaco={2}>
              <Caixa
                como="span"
                aria-hidden
                className={cn("size-3 shrink-0 rounded-sm", corDeStatus(f.cor).fundo)}
              />
              <Texto como="span" variante="corpo">
                {f.rotulo}
              </Texto>
              <Texto como="span" variante="corpo" className="ml-auto font-semibold tabular-nums">
                {f.quantidade}
              </Texto>
            </Linha>
          ))}
        </Pilha>
      </Linha>
    </CartaoDeGrafico>
  );
}
