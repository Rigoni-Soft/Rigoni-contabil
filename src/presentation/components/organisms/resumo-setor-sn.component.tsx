import { Caixa } from "@/presentation/components/atoms/caixa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { CartaoDeResumo } from "@/presentation/components/molecules/cartao-de-resumo.component";

// Tipo estrutural local (não importa o DTO do módulo clientes — view burra,
// arquitetura.md §3.4): qualquer objeto com este shape serve.
type Card = { id: string; titulo: string; cor: string; quantidade: number };

type Props = { cards: Card[]; totalClientes: number; busca: React.ReactNode };

function Grupo({
  titulo,
  cards,
  totalClientes,
}: {
  titulo: string;
  cards: Card[];
  totalClientes: number;
}) {
  return (
    <Caixa>
      <Texto variante="secao" className="mb-3 border-b border-border pb-2">
        {titulo}
      </Texto>
      <Caixa como="ul" className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((card) => (
          <CartaoDeResumo
            key={card.id}
            href={`/clientes/resumo/${card.id}`}
            titulo={card.titulo}
            cor={card.cor}
            quantidade={card.quantidade}
            totalClientes={totalClientes}
          />
        ))}
      </Caixa>
    </Caixa>
  );
}

// A ordem dos 9 cards é um invariante do mapper (resumo-setor-sn.mapper.spec.ts
// garante a ordem exata): os 5 primeiros são "Documentos e DAS", os 4
// últimos são "Parcelamento" — mesmos dois grupos do protótipo aprovado.
// `busca` entra como slot: o Buscar cliente é do módulo clientes (Container com
// estado), essa view global não pode importá-lo direto (arquitetura.md §3.4).
export function ResumoSetorSn({ cards, totalClientes, busca }: Props) {
  return (
    <Caixa como="section" className="space-y-6">
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
      <Grupo titulo="Documentos e DAS" cards={cards.slice(0, 5)} totalClientes={totalClientes} />
      <Grupo titulo="Parcelamento" cards={cards.slice(5, 9)} totalClientes={totalClientes} />
    </Caixa>
  );
}
