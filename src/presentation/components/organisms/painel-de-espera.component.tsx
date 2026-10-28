import { Caixa, Pilha } from "@/presentation/components/atoms/caixa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import {
  CardDeEspera,
  type CardDeEsperaProps,
} from "@/presentation/components/molecules/card-de-espera.component";

export type EsperaView = Omit<CardDeEsperaProps, "assumindo" | "onAssumir"> & { id: string };

type PainelDeEsperaProps = {
  itens: EsperaView[];
  carregando?: boolean;
  assumindo: boolean;
  onAssumir: (id: string) => void;
  // Líder e Admin: o card dirigido a outro abre a conversa em leitura de supervisão.
  onLer?: (id: string) => void;
};

// A aba "Em espera": os clientes do Setor, do mais antigo ao mais novo (a ordem vem pronta).
export function PainelDeEspera({
  itens,
  carregando = false,
  assumindo,
  onAssumir,
  onLer,
}: PainelDeEsperaProps) {
  if (carregando) {
    return (
      <Texto variante="apoio" role="status">
        Carregando…
      </Texto>
    );
  }
  if (itens.length === 0) return <Texto variante="apoio">Nenhum cliente em espera.</Texto>;
  return (
    <Pilha espaco={2} como="ol" aria-label="Clientes em espera">
      {itens.map((card) => (
        <Caixa como="li" key={card.id}>
          <CardDeEspera
            {...card}
            assumindo={assumindo}
            onAssumir={() => onAssumir(card.id)}
            onLer={onLer && (() => onLer(card.id))}
          />
        </Caixa>
      ))}
    </Pilha>
  );
}
