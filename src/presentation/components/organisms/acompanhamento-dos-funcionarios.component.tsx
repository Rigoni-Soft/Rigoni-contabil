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
  percentual: number;
  href: string;
  faltam: { servicoId: string; nome: string; clientes: number }[];
};

type Props = {
  rotuloMes: string;
  anteriorHref: string;
  proximoHref?: string;
  funcionarios: FuncionarioDoGrafico[];
  semResponsavel: { clienteId: string; empresa: string }[];
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
      <Caixa
        como="nav"
        aria-label="Mês do acompanhamento"
        className="grid grid-cols-[1fr_auto_1fr] items-center gap-2"
      >
        <Caixa>
          <LinkDeAcao href={anteriorHref} variant="ghost">
            Mês anterior
          </LinkDeAcao>
        </Caixa>
        <Texto como="span" variante="subtitulo" aria-current="date" className="capitalize">
          {rotuloMes}
        </Texto>
        <Caixa className="justify-self-end">
          {proximoHref && (
            <LinkDeAcao href={proximoHref} variant="ghost">
              Próximo mês
            </LinkDeAcao>
          )}
        </Caixa>
      </Caixa>

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
        <Texto variante="nota">
          Um ponto por cliente com todos os serviços do mês concluídos, inclusive o Holerite.
        </Texto>
      </CartaoDeGrafico>

      {funcionarios.length > 0 && (
        <CartaoDeGrafico titulo="Clientes que faltam por serviço">
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
                <CelulaDeTabela>{f.nome}</CelulaDeTabela>
                {f.faltam.map((c) => (
                  <CelulaDeTabela key={c.servicoId} numerica>
                    {c.clientes}
                  </CelulaDeTabela>
                ))}
              </LinhaDeTabela>
            ))}
          </Tabela>
        </CartaoDeGrafico>
      )}

      {semResponsavel.length > 0 && (
        <CartaoDeGrafico titulo="Sem responsável">
          <Texto variante="apoio">Estes clientes não contam para nenhum funcionário.</Texto>
          <Pilha espaco={1} como="ul">
            {semResponsavel.map((c) => (
              <Caixa como="li" key={c.clienteId}>
                {c.empresa}
              </Caixa>
            ))}
          </Pilha>
        </CartaoDeGrafico>
      )}
    </Pilha>
  );
}
