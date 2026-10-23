import Link from "next/link";

import { Caixa, Linha } from "@/presentation/components/atoms/caixa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";

type LinhaDeClienteProps = {
  href: string;
  empresa: string;
  cnpj: string;
  // Informação extra do Cliente na lista (ex.: parcelamentos). Fica abaixo da linha, fora do link:
  // o nome acessível do link continua sendo só empresa e CNPJ, e a lista interna mantém a navegação.
  detalhes?: React.ReactNode;
};

// Cliente em lista: leva ao cadastro operacional dele.
export function LinhaDeCliente({ href, empresa, cnpj, detalhes }: LinhaDeClienteProps) {
  return (
    <Caixa>
      <Linha
        como={Link}
        href={href}
        alinhar="centro"
        justificar="entre"
        espaco={3}
        className="px-4 py-3 hover:bg-accent/50"
      >
        <Caixa className="min-w-0">
          <Texto variante="destaque" className="break-words">
            {empresa}
          </Texto>
          <Texto variante="apoio">{cnpj}</Texto>
        </Caixa>
        <Texto como="span" variante="apoio" className="shrink-0">
          Ver cadastro →
        </Texto>
      </Linha>
      {detalhes && <Caixa className="px-4 pb-3">{detalhes}</Caixa>}
    </Caixa>
  );
}
