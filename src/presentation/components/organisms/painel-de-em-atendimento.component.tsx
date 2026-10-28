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
};

// A aba "Em atendimento": os Atendimentos do usuário; clicar abre o chat no centro.
export function PainelDeEmAtendimento({ itens, abertoId, onAbrir }: PainelDeEmAtendimentoProps) {
  if (itens.length === 0) {
    return <Texto variante="apoio">Você não tem atendimentos em andamento.</Texto>;
  }
  return (
    <Pilha espaco={2} como="ol" aria-label="Meus atendimentos">
      {itens.map(({ id, ...card }) => (
        <Caixa como="li" key={id}>
          <CardDeConversa {...card} aberto={id === abertoId} onAbrir={() => onAbrir(id)} />
        </Caixa>
      ))}
    </Pilha>
  );
}
