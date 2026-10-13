import { BarraDeProgresso } from "@/presentation/components/atoms/barra-de-progresso.component";
import { CartaoDeGrafico } from "@/presentation/components/atoms/cartao-de-grafico.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
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
      {fatias.length === 0 && <Texto variante="apoio">Nenhum cliente atribuído ainda.</Texto>}
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
              <BarraDeProgresso porcentagem={pct} classe={corDaFatia(f.id).fundo} />
            </li>
          );
        })}
      </ul>
      <Texto variante="nota">{nota}</Texto>
    </CartaoDeGrafico>
  );
}
