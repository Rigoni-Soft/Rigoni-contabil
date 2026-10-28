import { Caixa, Pilha } from "@/presentation/components/atoms/caixa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import {
  CardDeConversa,
  type CardDeConversaProps,
} from "@/presentation/components/molecules/card-de-conversa.component";

export type ConversaView = Omit<CardDeConversaProps, "aberto" | "onAbrir"> & { id: string };

type PainelDeEmAtendimentoProps = {
  itens: ConversaView[];
  abertoId: string | null;
  onAbrir: (id: string) => void;
  // Líder e Admin: os Atendimentos dos outros, só para leitura.
  equipe?: ConversaView[];
};

// A aba "Em atendimento": os Atendimentos do usuário; clicar abre o chat no centro. Quem
// supervisiona vê também os dos outros, abertos em leitura.
export function PainelDeEmAtendimento({
  itens,
  abertoId,
  onAbrir,
  equipe,
}: PainelDeEmAtendimentoProps) {
  return (
    <Pilha espaco={4}>
      <ListaDeConversas
        titulo="Meus atendimentos"
        vazio="Você não tem atendimentos em andamento."
        itens={itens}
        abertoId={abertoId}
        onAbrir={onAbrir}
        comTitulo={equipe !== undefined}
      />
      {equipe && (
        <ListaDeConversas
          titulo="Da equipe (somente leitura)"
          vazio="Ninguém mais está em atendimento."
          itens={equipe}
          abertoId={abertoId}
          onAbrir={onAbrir}
          comTitulo
        />
      )}
    </Pilha>
  );
}

function ListaDeConversas({
  titulo,
  vazio,
  itens,
  abertoId,
  onAbrir,
  comTitulo = false,
}: {
  titulo: string;
  vazio: string;
  itens: ConversaView[];
  abertoId: string | null;
  onAbrir: (id: string) => void;
  // Com a seção da equipe ao lado, cada lista diz de quem é.
  comTitulo?: boolean;
}) {
  const lista =
    itens.length === 0 ? (
      <Texto variante="apoio">{vazio}</Texto>
    ) : (
      <Pilha espaco={2} como="ol" aria-label={titulo}>
        {itens.map(({ id, ...card }) => (
          <Caixa como="li" key={id}>
            <CardDeConversa {...card} aberto={id === abertoId} onAbrir={() => onAbrir(id)} />
          </Caixa>
        ))}
      </Pilha>
    );
  if (!comTitulo) return lista;
  return (
    <Pilha espaco={2} como="section" aria-label={titulo}>
      <Texto como="h3" variante="rotuloDeSecao">
        {titulo}
      </Texto>
      {lista}
    </Pilha>
  );
}
