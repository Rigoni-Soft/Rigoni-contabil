import Link from "next/link";

import { Caixa, Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import { CartaoDeGrafico } from "@/presentation/components/atoms/cartao-de-grafico.component";
import {
  CabecalhoDeColuna,
  CelulaDeTabela,
  LinhaDeTabela,
  Tabela,
} from "@/presentation/components/atoms/celula-de-tabela.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { ListaDeClientes } from "@/presentation/components/molecules/lista-de-clientes.component";
import { NavegacaoDeMes } from "@/presentation/components/molecules/navegacao-de-mes.component";

export type FuncionarioDoGrafico = {
  id: string;
  nome: string;
  atribuidos: number;
  pontos: number;
  percentual: number;
  href: string;
  // `href`: a lista das empresas que faltam naquele serviço para este funcionário.
  faltam: { servicoId: string; nome: string; clientes: number; href: string }[];
};

type Props = {
  rotuloMes: string;
  anteriorHref: string;
  proximoHref?: string;
  funcionarios: FuncionarioDoGrafico[];
  // `href`: o cadastro operacional do cliente, para atribuir o Responsável.
  semResponsavel: { clienteId: string; empresa: string; cnpj: string; href: string }[];
};

// Pontos x clientes atribuídos por Funcionário e, logo abaixo, quantos clientes faltam em cada serviço.
export function AcompanhamentoDosFuncionarios({
  rotuloMes,
  anteriorHref,
  proximoHref,
  funcionarios,
  semResponsavel,
}: Props) {
  const servicos = funcionarios[0]?.faltam ?? [];
  return (
    <Pilha espaco={6}>
      <NavegacaoDeMes rotuloMes={rotuloMes} anteriorHref={anteriorHref} proximoHref={proximoHref} />

      <CartaoDeGrafico titulo="Pontos por funcionário">
        {funcionarios.length === 0 && (
          <Texto variante="apoio">Nenhum cliente atribuído ainda.</Texto>
        )}
        <Pilha espaco={3} como="ul">
          {funcionarios.map((f) => (
            <Pilha espaco={1} como="li" key={f.id}>
              <Linha espaco={2}>
                <Link
                  href={f.href}
                  title={f.nome}
                  className="block min-w-0 truncate rounded-sm py-0.5 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-ring pointer-coarse:py-3"
                >
                  {f.nome}
                </Link>
                <Texto
                  como="span"
                  variante="corpo"
                  className="ml-auto shrink-0 font-semibold tabular-nums"
                >
                  {f.pontos} de {f.atribuidos}
                </Texto>
              </Linha>
              <Caixa aria-hidden className="h-2 rounded-full bg-border">
                <Caixa
                  className="h-2 rounded-full bg-primary"
                  style={{ width: `${f.percentual}%` }}
                />
              </Caixa>
            </Pilha>
          ))}
        </Pilha>
        {funcionarios.length > 0 && (
          <Texto variante="nota">
            Um ponto por cliente com todos os serviços do mês concluídos, inclusive o Holerite.
          </Texto>
        )}
      </CartaoDeGrafico>

      {funcionarios.length > 0 && (
        <CartaoDeGrafico titulo="Clientes que faltam por serviço">
          <Tabela
            legenda={`Clientes que faltam por serviço em ${rotuloMes}`}
            semMoldura
            colunas={
              <>
                <CabecalhoDeColuna fixa>Funcionário</CabecalhoDeColuna>
                {servicos.map((s) => (
                  <CabecalhoDeColuna key={s.servicoId} numerica>
                    {s.nome}
                  </CabecalhoDeColuna>
                ))}
              </>
            }
          >
            {funcionarios.map((f) => (
              <LinhaDeTabela key={f.id}>
                <CelulaDeTabela fixa>{f.nome}</CelulaDeTabela>
                {f.faltam.map((c) => (
                  <CelulaDeTabela key={c.servicoId} numerica>
                    <Link
                      href={c.href}
                      aria-label={`${c.nome} de ${f.nome}: ${c.clientes}`}
                      className="inline-block min-w-8 rounded-sm py-0.5 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-ring pointer-coarse:py-3"
                    >
                      {c.clientes}
                    </Link>
                  </CelulaDeTabela>
                ))}
              </LinhaDeTabela>
            ))}
          </Tabela>
        </CartaoDeGrafico>
      )}

      {semResponsavel.length > 0 && (
        <Pilha espaco={4} como="section" aria-labelledby="sem-responsavel">
          <Texto variante="secao" id="sem-responsavel" className="border-b border-border pb-2">
            Sem responsável
          </Texto>
          <Texto variante="apoio">Estes clientes não contam para nenhum funcionário.</Texto>
          <ListaDeClientes clientes={semResponsavel} />
        </Pilha>
      )}
    </Pilha>
  );
}
