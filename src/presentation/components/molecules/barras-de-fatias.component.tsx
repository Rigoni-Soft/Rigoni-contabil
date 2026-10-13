import { BarraDeProgresso } from "@/presentation/components/atoms/barra-de-progresso.component";
import { Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
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
      <Pilha espaco={3} como="ul">
        {fatias.map((f) => {
          const pct = totalClientes === 0 ? 0 : Math.min(100, (f.quantidade / totalClientes) * 100);
          return (
            <Pilha espaco={1} como="li" key={f.id}>
              <Linha espaco={2}>
                <Texto como="span" variante="corpo" className="truncate" title={f.rotulo}>
                  {f.rotulo}
                </Texto>
                <Texto
                  como="span"
                  variante="corpo"
                  className="ml-auto shrink-0 font-semibold tabular-nums"
                >
                  {f.quantidade}
                </Texto>
              </Linha>
              <BarraDeProgresso porcentagem={pct} classe={corDaFatia(f.id).fundo} />
            </Pilha>
          );
        })}
      </Pilha>
      <Texto variante="nota">{nota}</Texto>
    </CartaoDeGrafico>
  );
}
