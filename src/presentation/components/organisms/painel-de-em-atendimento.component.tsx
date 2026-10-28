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
      />
      {equipe && (
        <ListaDeConversas
          titulo="Da equipe (somente leitura)"
          vazio="Ninguém mais está em atendimento."
          itens={equipe}
          abertoId={abertoId}
          onAbrir={onAbrir}
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
}: {
  titulo: string;
  vazio: string;
  itens: ConversaView[];
  abertoId: string | null;
  onAbrir: (id: string) => void;
}) {
  if (itens.length === 0) return <Texto variante="apoio">{vazio}</Texto>;
  return (
    <Pilha espaco={2} como="ol" aria-label={titulo}>
      {itens.map(({ id, ...card }) => (
        <Caixa como="li" key={id}>
          <CardDeConversa {...card} aberto={id === abertoId} onAbrir={() => onAbrir(id)} />
        </Caixa>
      ))}
    </Pilha>
  );
}
