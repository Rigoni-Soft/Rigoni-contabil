import Link from "next/link";

import { Caixa, Linha } from "@/presentation/components/atoms/caixa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";

type LinhaDeClienteProps = {
  href: string;
  empresa: string;
  cnpj: string;
  detalhes?: React.ReactNode;
  acao?: string;
};

export function LinhaDeCliente({
  href,
  empresa,
  cnpj,
  detalhes,
  acao = "Ver cadastro →",
}: LinhaDeClienteProps) {
  return (
    <Caixa>
      <Linha
        como={Link}
        href={href}
        alinhar="centro"
        justificar="entre"
        espaco={3}
        className="px-4 py-3 hover:bg-accent/50 focus-visible:-outline-offset-2"
      >
        <Caixa className="min-w-0">
          <Texto variante="destaque" className="break-words">
            {empresa}
          </Texto>
          <Texto variante="apoio">{cnpj}</Texto>
        </Caixa>
        <Texto como="span" variante="apoio" className="shrink-0">
          {acao}
        </Texto>
      </Linha>
      {detalhes && <Caixa className="px-4 pt-1 pb-3">{detalhes}</Caixa>}
    </Caixa>
  );
}
