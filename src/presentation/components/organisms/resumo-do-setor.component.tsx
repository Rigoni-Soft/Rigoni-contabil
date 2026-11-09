import { Caixa, Grade, Pilha } from "@/presentation/components/atoms/caixa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { CartaoDeResumo } from "@/presentation/components/molecules/cartao-de-resumo.component";

// Tipos estruturais locais (não importam o DTO do módulo clientes — view burra,
// arquitetura.md §3.4): qualquer objeto com estes shapes serve.
// `total` só os cards que não contam sobre a carteira inteira trazem (ex.: o acompanhamento do RH, que
// conta sobre os clientes que têm Responsável).
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
  // Como os cards se agrupam e em que ordem: quem monta o resumo do Setor declara, a tela não adivinha.
  grupos: Grupo[];
  totalClientes: number;
  // Rota da lista de cada card: `${hrefBase}/${id do card}`.
  hrefBase: string;
  busca: React.ReactNode;
};

// 5 cards cabem em 5 colunas; outras quantidades em 5 colunas deixariam um órfão (6 viram 2 linhas de 3).
const colunasPara = (quantidade: number) => (quantidade % 5 === 0 ? "2>3>5" : "2>3");

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
          // Em 2 colunas (celular) um grupo ímpar deixaria o último card sozinho: ele ocupa a linha toda.
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

// Esqueleto do resumo de qualquer Setor: título, busca, aviso de lista vazia e os grupos de cards.
// `busca` entra como slot: o Buscar cliente é do módulo clientes (Container com
// estado), essa view global não pode importá-lo direto (arquitetura.md §3.4).
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
