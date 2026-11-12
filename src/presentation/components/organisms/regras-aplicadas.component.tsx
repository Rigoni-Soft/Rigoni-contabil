import { Pilha } from "@/presentation/components/atoms/caixa.component";
import {
  CabecalhoDeColuna,
  CelulaDeTabela,
  LinhaDeTabela,
  Tabela,
} from "@/presentation/components/atoms/celula-de-tabela.component";
import { Texto } from "@/presentation/components/atoms/texto.component";

export type LinhaDeRegra = {
  chave: string;
  rotulo: string;
  aplicada: boolean;
  // Entra no cálculo da Totalização; a regra extraída que não entra aparece com a nota.
  noCalculo: boolean;
  valor: string;
  legislacao: string;
  diferenca: string;
  clausula: string;
  trecho: string;
  // Só nos parâmetros que o modelo propôs e o domínio recusou.
  motivo: string | undefined;
};

type Props = {
  // "Comércio · 01/05/2026 a 30/04/2027".
  titulo: string;
  linhas: LinhaDeRegra[];
};

// "Regras aplicadas", só leitura: por parâmetro, o valor da convenção, a cláusula de onde veio e a diferença
// para a legislação. O que a convenção não trouxe (ou o domínio recusou) aparece como "Não aplicada".
export function RegrasAplicadas({ titulo, linhas }: Props) {
  return (
    <Pilha como="section" espaco={3} aria-label="Regras aplicadas">
      <Texto como="h2" variante="subtitulo">
        Regras aplicadas
      </Texto>
      <Texto variante="apoio">{titulo}</Texto>
      <Tabela
        legenda="Regras aplicadas da convenção"
        colunas={
          <>
            <CabecalhoDeColuna fixa>Parâmetro</CabecalhoDeColuna>
            <CabecalhoDeColuna>Na convenção</CabecalhoDeColuna>
            <CabecalhoDeColuna>Na legislação</CabecalhoDeColuna>
            <CabecalhoDeColuna>Diferença</CabecalhoDeColuna>
            <CabecalhoDeColuna>Cláusula</CabecalhoDeColuna>
          </>
        }
      >
        {linhas.map((l) => (
          <LinhaDeTabela key={l.chave}>
            <CelulaDeTabela fixa>{l.rotulo}</CelulaDeTabela>
            <CelulaDeTabela>
              <Texto como="span" variante={l.aplicada ? "destaque" : "apoio"}>
                {l.valor}
              </Texto>
              {l.aplicada && !l.noCalculo && (
                <Texto variante="nota">Não entra no cálculo da Totalização</Texto>
              )}
              {l.motivo && <Texto variante="nota">Recusada: {l.motivo}</Texto>}
            </CelulaDeTabela>
            <CelulaDeTabela>{l.legislacao}</CelulaDeTabela>
            <CelulaDeTabela>{l.diferenca}</CelulaDeTabela>
            <CelulaDeTabela>
              {l.aplicada ? (
                <>
                  <Texto como="span" variante="corpo">
                    {l.clausula}
                  </Texto>
                  <Texto variante="nota">“{l.trecho}”</Texto>
                </>
              ) : (
                "—"
              )}
            </CelulaDeTabela>
          </LinhaDeTabela>
        ))}
      </Tabela>
    </Pilha>
  );
}
