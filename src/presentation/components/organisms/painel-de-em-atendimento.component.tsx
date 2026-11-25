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
  equipe?: ConversaView[];
};

export function PainelDeEmAtendimento({
  itens,
  abertoId,
  onAbrir,
  equipe,
}: PainelDeEmAtendimentoProps) {
  return (
    <Pilha espaco={4}>
      <ListaDeConversas
        idDoTitulo="titulo-meus-atendimentos"
        titulo="Meus atendimentos"
        vazio="Você não tem atendimentos em andamento."
        itens={itens}
        abertoId={abertoId}
        onAbrir={onAbrir}
        comTitulo={equipe !== undefined}
      />
      {equipe && (
        <ListaDeConversas
          idDoTitulo="titulo-atendimentos-da-equipe"
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
  idDoTitulo,
  titulo,
  vazio,
  itens,
  abertoId,
  onAbrir,
  comTitulo = false,
}: {
  idDoTitulo: string;
  titulo: string;
  vazio: string;
  itens: ConversaView[];
  abertoId: string | null;
  onAbrir: (id: string) => void;
  comTitulo?: boolean;
}) {
  const lista =
    itens.length === 0 ? (
      <Texto variante="apoio">{vazio}</Texto>
    ) : (
      <Pilha espaco={2} como="ol" aria-labelledby={comTitulo ? idDoTitulo : undefined}>
        {itens.map(({ id, ...card }) => (
          <Caixa como="li" key={id}>
            <CardDeConversa {...card} aberto={id === abertoId} onAbrir={() => onAbrir(id)} />
          </Caixa>
        ))}
      </Pilha>
    );
  if (!comTitulo) return lista;
  return (
    <Pilha espaco={2}>
      <Texto como="h2" variante="rotuloDeSecao" id={idDoTitulo}>
        {titulo}
      </Texto>
      {lista}
    </Pilha>
  );
}
