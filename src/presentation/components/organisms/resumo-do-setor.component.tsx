import { Caixa, Grade, Pilha } from "@/presentation/components/atoms/caixa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { CartaoDeResumo } from "@/presentation/components/molecules/cartao-de-resumo.component";

type Card = {
  id: string;
  titulo: string;
  cor: string;
  quantidade: number;
  total?: number;
};
type Grupo = { titulo: string; cardIds: string[] };

type Props = {
  cards: Card[];
  grupos: Grupo[];
  totalClientes: number;
  hrefBase: string;
  busca: React.ReactNode;
};

const COLUNAS_DA_TELA_LARGA = 5;

const colunasPara = (quantidade: number) =>
  quantidade % COLUNAS_DA_TELA_LARGA === 0 ? "2>3>5" : "2>3";

function GrupoDeCards({
  titulo,
  cards,
  totalClientes,
  hrefBase,
}: {
  titulo: string;
  cards: Card[];
  totalClientes: number;
  hrefBase: string;
}) {
  return (
    <Caixa>
      <Texto variante="secao" className="mb-3 border-b border-border pb-2">
        {titulo}
      </Texto>
      <Grade colunas={colunasPara(cards.length)} espaco={4} como="ul">
        {cards.map((card) => (
          <Caixa como="li" key={card.id} className="max-sm:last:odd:col-span-2">
            <CartaoDeResumo
              href={`${hrefBase}/${card.id}`}
              titulo={card.titulo}
              cor={card.cor}
              quantidade={card.quantidade}
              totalClientes={card.total ?? totalClientes}
            />
          </Caixa>
        ))}
      </Grade>
    </Caixa>
  );
}

export function ResumoDoSetor({ cards, grupos, totalClientes, hrefBase, busca }: Props) {
  const porId = new Map(cards.map((card) => [card.id, card]));
  return (
    <Pilha espaco={6} como="section">
      <Texto como="h1" variante="tela">
        Resumo do setor
      </Texto>
      {busca}
      {totalClientes === 0 && (
        <Texto variante="apoio">
          Nenhum cliente para mostrar ainda. Os clientes do setor aparecem aqui assim que forem
          cadastrados e atribuídos.
        </Texto>
      )}
      {grupos.map((grupo) => (
        <GrupoDeCards
          key={grupo.titulo}
          titulo={grupo.titulo}
          cards={grupo.cardIds.flatMap((id) => porId.get(id) ?? [])}
          totalClientes={totalClientes}
          hrefBase={hrefBase}
        />
      ))}
    </Pilha>
  );
}
