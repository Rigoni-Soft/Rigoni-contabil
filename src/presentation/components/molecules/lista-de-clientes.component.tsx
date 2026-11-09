import { Caixa } from "@/presentation/components/atoms/caixa.component";
import { ListaComDivisores } from "@/presentation/components/atoms/lista-com-divisores.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { LinhaDeCliente } from "@/presentation/components/molecules/linha-de-cliente.component";
import { formatarCnpj } from "@/presentation/lib/cnpj-mask";

type Cliente = {
  clienteId: string;
  empresa: string;
  cnpj: string;
  // Para onde a linha leva (o cadastro operacional, já com o `voltarPara` de quem monta).
  href: string;
  // Dado extra do Cliente nesta lista (ex.: "3 meses"), abaixo da linha.
  detalhe?: string;
};

// A lista de Clientes do padrão de drill-down (DESIGN.md): linhas com divisor, empresa em destaque,
// CNPJ mascarado e "Ver cadastro →".
export function ListaDeClientes({ clientes }: { clientes: Cliente[] }) {
  return (
    <ListaComDivisores>
      {clientes.map((c) => (
        <Caixa como="li" key={c.clienteId}>
          <LinhaDeCliente
            href={c.href}
            empresa={c.empresa}
            cnpj={formatarCnpj(c.cnpj)}
            detalhes={c.detalhe && <Texto variante="apoio">{c.detalhe}</Texto>}
          />
        </Caixa>
      ))}
    </ListaComDivisores>
  );
}
