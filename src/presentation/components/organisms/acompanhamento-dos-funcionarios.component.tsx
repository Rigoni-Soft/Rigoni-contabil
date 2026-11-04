import Link from "next/link";

import { Caixa, Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import { CartaoDeGrafico } from "@/presentation/components/atoms/cartao-de-grafico.component";
import {
  CabecalhoDeColuna,
  CelulaDeTabela,
  LinhaDeTabela,
  Tabela,
} from "@/presentation/components/atoms/celula-de-tabela.component";
import { LinkDeAcao } from "@/presentation/components/atoms/link-de-acao.component";
import { Texto } from "@/presentation/components/atoms/texto.component";

export type FuncionarioDoGrafico = {
  id: string;
  nome: string;
  atribuidos: number;
  pontos: number;
  href: string;
  faltam: { servicoId: string; nome: string; clientes: number }[];
};

type Props = {
  rotuloMes: string;
  anteriorHref: string;
  proximoHref?: string;
  funcionarios: FuncionarioDoGrafico[];
  semResponsavel: string[];
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
      <Linha espaco={2}>
        <LinkDeAcao href={anteriorHref} variant="ghost">
          Mês anterior
        </LinkDeAcao>
        <Texto como="span" variante="subtitulo" className="mx-auto capitalize">
          {rotuloMes}
        </Texto>
        {proximoHref && (
          <LinkDeAcao href={proximoHref} variant="ghost">
            Próximo mês
          </LinkDeAcao>
        )}
      </Linha>

      <CartaoDeGrafico titulo="Pontos por funcionário">
        {funcionarios.length === 0 && <Texto variante="apoio">Nenhum cliente atribuído ainda.</Texto>}
        <Pilha espaco={3} como="ul">
          {funcionarios.map((f) => (
            <Pilha espaco={1} como="li" key={f.id}>
              <Linha espaco={2}>
                <Link href={f.href} className="truncate underline-offset-2 hover:underline">
                  {f.nome}
                </Link>
                <Texto como="span" variante="corpo" className="ml-auto shrink-0 font-semibold tabular-nums">
                  {f.pontos} de {f.atribuidos}
                </Texto>
              </Linha>
              <Caixa aria-hidden className="h-2 rounded-full bg-border">
                <Caixa
                  className="h-2 rounded-full bg-primary"
                  style={{ width: `${f.atribuidos === 0 ? 0 : (f.pontos / f.atribuidos) * 100}%` }}
                />
              </Caixa>
            </Pilha>
          ))}
        </Pilha>
        <Texto variante="nota">
          Um ponto por cliente com todos os serviços do mês concluídos, inclusive o Holerite.
        </Texto>
      </CartaoDeGrafico>

      {funcionarios.length > 0 && (
        <Tabela
          colunas={
            <>
              <CabecalhoDeColuna>Funcionário</CabecalhoDeColuna>
              {servicos.map((s) => (
                <CabecalhoDeColuna key={s.servicoId}>{s.nome}</CabecalhoDeColuna>
              ))}
            </>
          }
        >
          {funcionarios.map((f) => (
            <LinhaDeTabela key={f.id}>
              <CelulaDeTabela>
                <Link href={f.href} className="underline-offset-2 hover:underline">
                  {f.nome}
                </Link>
              </CelulaDeTabela>
              {f.faltam.map((c) => (
                <CelulaDeTabela key={c.servicoId} numerica>
                  {c.clientes}
                </CelulaDeTabela>
              ))}
            </LinhaDeTabela>
          ))}
        </Tabela>
      )}

      {semResponsavel.length > 0 && (
        <CartaoDeGrafico titulo="Sem responsável">
          <Texto variante="apoio">Estes clientes não contam para nenhum funcionário.</Texto>
          <Pilha espaco={1} como="ul">
            {semResponsavel.map((empresa) => (
              <Caixa como="li" key={empresa}>
                {empresa}
              </Caixa>
            ))}
          </Pilha>
        </CartaoDeGrafico>
      )}
    </Pilha>
  );
}
