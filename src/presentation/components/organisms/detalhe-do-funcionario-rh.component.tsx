import { Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import { CartaoDeGrafico } from "@/presentation/components/atoms/cartao-de-grafico.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { ListaDeClientes } from "@/presentation/components/molecules/lista-de-clientes.component";

type Props = {
  nome: string;
  rotuloMes: string;
  pontos: number;
  atribuidos: number;
  percentual: number;
  pendencias: {
    servicoId: string;
    nome: string;
    clientes: { clienteId: string; empresa: string; cnpj: string; href: string }[];
  }[];
  evolucao: { competencia: string; rotulo: string; percentual: number }[];
  maisAtrasados: {
    clienteId: string;
    empresa: string;
    cnpj: string;
    href: string;
    meses: number;
  }[];
};

// O que falta fechar de um Funcionário no mês: clientes por serviço pendente, evolução e os mais atrasados.
export function DetalheDoFuncionarioRh({
  nome,
  rotuloMes,
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
        {nome}: {percentual}% em {rotuloMes} ({pontos} de {atribuidos})
      </Texto>

      <Pilha espaco={4} como="section" aria-labelledby="pendente-por-servico">
        <Texto
          variante="secao"
          como="h2"
          id="pendente-por-servico"
          className="border-b border-border pb-2"
        >
          Pendente por serviço
        </Texto>
        {pendencias.length === 0 && <Texto variante="apoio">Tudo concluído neste mês.</Texto>}
        {pendencias.map((p) => (
          <Pilha espaco={2} key={p.servicoId}>
            <Texto variante="corpo" como="h3" className="font-semibold">
              {p.nome} ({p.clientes.length})
            </Texto>
            <ListaDeClientes clientes={p.clientes} />
          </Pilha>
        ))}
      </Pilha>

      <CartaoDeGrafico titulo="Evolução">
        {evolucao.length === 0 && (
          <Texto variante="apoio">Sem meses anteriores para comparar.</Texto>
        )}
        <Pilha espaco={1} como="ul">
          {evolucao.map((m) => (
            <Linha como="li" justificar="entre" key={m.competencia} className="tabular-nums">
              <Texto como="span" variante="corpo" className="first-letter:uppercase">
                {m.rotulo}
              </Texto>
              <Texto como="span" variante="corpo">
                {m.percentual}%
              </Texto>
            </Linha>
          ))}
        </Pilha>
      </CartaoDeGrafico>

      <Pilha espaco={4} como="section" aria-labelledby="mais-atrasados">
        <Texto
          variante="secao"
          como="h2"
          id="mais-atrasados"
          className="border-b border-border pb-2"
        >
          Mais atrasados
        </Texto>
        {maisAtrasados.length === 0 && <Texto variante="apoio">Nenhum cliente atrasado.</Texto>}
        {maisAtrasados.length > 0 && (
          <ListaDeClientes
            clientes={maisAtrasados.map((c) => ({
              ...c,
              detalhes: (
                <Texto variante="apoio">{`${c.meses} ${c.meses === 1 ? "mês" : "meses"}`}</Texto>
              ),
            }))}
          />
        )}
      </Pilha>
    </Pilha>
  );
}
