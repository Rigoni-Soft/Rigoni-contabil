import { Caixa, Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import { CartaoDeGrafico } from "@/presentation/components/atoms/cartao-de-grafico.component";
import { Texto } from "@/presentation/components/atoms/texto.component";

type Props = {
  nome: string;
  pontos: number;
  atribuidos: number;
  percentual: number;
  pendencias: { servicoId: string; nome: string; clientes: string[] }[];
  evolucao: { competencia: string; rotulo: string; percentual: number }[];
  maisAtrasados: { clienteId: string; empresa: string; meses: number }[];
};

// O que falta fechar de um Funcionário no mês: clientes por serviço pendente, evolução e os mais atrasados.
export function DetalheDoFuncionarioRh({
  nome,
  pontos,
  atribuidos,
  percentual,
  pendencias,
  evolucao,
  maisAtrasados,
}: Props) {
  return (
    <Pilha espaco={6}>
      <Texto variante="subtitulo" como="h2">
        {nome}: {percentual}% do mês ({pontos} de {atribuidos})
      </Texto>

      <CartaoDeGrafico titulo="Pendente por serviço">
        {pendencias.length === 0 && <Texto variante="apoio">Tudo concluído neste mês.</Texto>}
        {pendencias.map((p) => (
          <Pilha espaco={1} key={p.servicoId}>
            <Texto variante="corpo" className="font-semibold">
              {p.nome} ({p.clientes.length})
            </Texto>
            <Pilha espaco={1} como="ul">
              {p.clientes.map((empresa) => (
                <Caixa como="li" key={empresa}>
                  {empresa}
                </Caixa>
              ))}
            </Pilha>
          </Pilha>
        ))}
      </CartaoDeGrafico>

      <CartaoDeGrafico titulo="Evolução">
        <Pilha espaco={1} como="ul">
          {evolucao.map((m) => (
            <Linha como="li" justificar="entre" key={m.competencia} className="tabular-nums">
              <Texto como="span" variante="corpo" className="capitalize">
                {m.rotulo}
              </Texto>
              <Texto como="span" variante="corpo">
                {m.percentual}%
              </Texto>
            </Linha>
          ))}
        </Pilha>
      </CartaoDeGrafico>

      <CartaoDeGrafico titulo="Mais atrasados">
        {maisAtrasados.length === 0 && <Texto variante="apoio">Nenhum cliente atrasado.</Texto>}
        <Pilha espaco={1} como="ul">
          {maisAtrasados.map((c) => (
            <Linha como="li" justificar="entre" key={c.clienteId}>
              <Texto como="span" variante="corpo">
                {c.empresa}
              </Texto>
              <Texto como="span" variante="corpo" className="tabular-nums">
                {c.meses} {c.meses === 1 ? "mês" : "meses"}
              </Texto>
            </Linha>
          ))}
        </Pilha>
      </CartaoDeGrafico>
    </Pilha>
  );
}
