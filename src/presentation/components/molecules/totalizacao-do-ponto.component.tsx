import { Grade, Pilha } from "@/presentation/components/atoms/caixa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";

export type ItemDaTotalizacao = { rotulo: string; valor: string };

type Props = { titulo: string; itens: ItemDaTotalizacao[] };

// A Totalização do período: um valor por linha, calculado pela legislação (nunca digitado).
export function TotalizacaoDoPonto({ titulo, itens }: Props) {
  return (
    <Pilha como="section" espaco={3} aria-label={titulo}>
      <Texto como="h3" variante="rotuloDeSecao">
        {titulo}
      </Texto>
      <Grade como="dl" colunas="2>4" espaco={4}>
        {itens.map((item) => (
          <Pilha key={item.rotulo} espaco={1}>
            <Texto como="dt" variante="apoio">
              {item.rotulo}
            </Texto>
            <Texto como="dd" variante="subtitulo">
              {item.valor}
            </Texto>
          </Pilha>
        ))}
      </Grade>
    </Pilha>
  );
}
