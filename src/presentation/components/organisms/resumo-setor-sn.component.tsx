import { Caixa, Grade, Pilha } from "@/presentation/components/atoms/caixa.component";
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
  colunas,
}: {
  titulo: string;
  cards: Card[];
  totalClientes: number;
  colunas: "2>3" | "2>3>5";
}) {
  return (
    <Caixa>
      <Texto variante="secao" className="mb-3 border-b border-border pb-2">
        {titulo}
      </Texto>
      <Grade colunas={colunas} espaco={4} como="ul">
        {cards.map((card) => (
          // Em 2 colunas (celular) um grupo ímpar deixaria o último card sozinho: ele ocupa a linha toda.
          <Caixa como="li" key={card.id} className="max-sm:last:odd:col-span-2">
            <CartaoDeResumo
              href={`/clientes/resumo/${card.id}`}
              titulo={card.titulo}
              cor={card.cor}
              quantidade={card.quantidade}
              totalClientes={totalClientes}
            />
          </Caixa>
        ))}
      </Grade>
    </Caixa>
  );
}

// A ordem dos 11 cards é um invariante do mapper (resumo-setor-sn.mapper.spec.ts garante a ordem
// exata): os 5 primeiros são "Documentos e DAS", os 6 últimos são "Parcelamento".
// `busca` entra como slot: o Buscar cliente é do módulo clientes (Container com
// estado), essa view global não pode importá-lo direto (arquitetura.md §3.4).
export function ResumoSetorSn({ cards, totalClientes, busca }: Props) {
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
      <Grupo
        titulo="Documentos e DAS"
        cards={cards.slice(0, 5)}
        totalClientes={totalClientes}
        colunas="2>3>5"
      />
      {/* 6 cards: em 5 colunas sobraria um órfão; 3 colunas fecham 2 linhas cheias. */}
      <Grupo
        titulo="Parcelamento"
        cards={cards.slice(5, 11)}
        totalClientes={totalClientes}
        colunas="2>3"
      />
    </Pilha>
  );
}
