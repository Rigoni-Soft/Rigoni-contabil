import Link from "next/link";

import { Caixa, Linha } from "@/presentation/components/atoms/caixa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";

type LinhaDeClienteProps = {
  href: string;
  empresa: string;
  cnpj: string;
  // Informação extra do Cliente na lista (ex.: parcelamentos), abaixo do CNPJ.
  detalhes?: React.ReactNode;
};

// Cliente em lista: leva ao cadastro operacional dele.
export function LinhaDeCliente({ href, empresa, cnpj, detalhes }: LinhaDeClienteProps) {
  return (
    <Linha
      como={Link}
      href={href}
      alinhar="centro"
      justificar="entre"
      espaco={3}
      className="px-4 py-3 hover:bg-accent/50"
    >
      <Caixa>
        <Texto variante="destaque">{empresa}</Texto>
        <Texto variante="apoio">{cnpj}</Texto>
        {detalhes}
      </Caixa>
      <Texto como="span" variante="apoio">
        Ver cadastro →
      </Texto>
    </Linha>
  );
}
