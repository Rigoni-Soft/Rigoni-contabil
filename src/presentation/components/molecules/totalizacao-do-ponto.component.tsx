import { Grade, Pilha } from "@/presentation/components/atoms/caixa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";

export type ItemDaTotalizacao = { rotulo: string; valor: string };

type Props = {
  titulo: string;
  itens: ItemDaTotalizacao[];
  // Logo depois de salvar: o bloco ganha contorno e fundo para os números novos saltarem aos olhos.
  destaque?: boolean;
};

// A Totalização do período: um valor por linha, calculado pela convenção vigente, com a legislação onde ela não decide (nunca digitado).
export function TotalizacaoDoPonto({ titulo, itens, destaque = false }: Props) {
  return (
    <Pilha
      como="section"
      espaco={3}
      aria-label={titulo}
      className={destaque ? "rounded-md border border-primary bg-accent/40 p-3" : undefined}
    >
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
