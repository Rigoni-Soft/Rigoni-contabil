import { LinkDeLinha } from "@/presentation/components/atoms/link-de-linha.component";
import { Texto } from "@/presentation/components/atoms/texto.component";

type LinhaDeClienteProps = {
  href: string;
  empresa: string;
  cnpj: string;
};

// Cliente em lista: leva ao cadastro operacional dele.
export function LinhaDeCliente({ href, empresa, cnpj }: LinhaDeClienteProps) {
  return (
    <li>
      <LinkDeLinha href={href}>
        <div>
          <Texto variante="destaque">{empresa}</Texto>
          <Texto variante="apoio">{cnpj}</Texto>
        </div>
        <Texto como="span" variante="apoio">
          Ver cadastro →
        </Texto>
      </LinkDeLinha>
    </li>
  );
}
