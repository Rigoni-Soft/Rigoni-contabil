import { corDaFatia, type Fatia } from "@/presentation/lib/fatia-de-grafico";

// Item de legenda: amostra de cor + rótulo + quantidade (a cor nunca é o único canal).
export function LegendaDeFatia({ fatia }: { fatia: Fatia }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      <span aria-hidden className={`size-3 shrink-0 rounded-sm ${corDaFatia(fatia.id).fundo}`} />
      <span className="text-foreground">{fatia.rotulo}</span>
      <span className="ml-auto font-semibold text-foreground tabular-nums">{fatia.quantidade}</span>
    </li>
  );
}
