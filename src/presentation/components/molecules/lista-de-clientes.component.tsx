import { Caixa } from "@/presentation/components/atoms/caixa.component";
import { ListaComDivisores } from "@/presentation/components/atoms/lista-com-divisores.component";
import { LinhaDeCliente } from "@/presentation/components/molecules/linha-de-cliente.component";
import { formatarCnpj } from "@/presentation/lib/cnpj-mask";

type Cliente = {
  clienteId: string;
  empresa: string;
  cnpj: string;
  href: string;
  detalhes?: React.ReactNode;
  acao?: string;
};

export function ListaDeClientes({ clientes }: { clientes: Cliente[] }) {
  return (
    <ListaComDivisores>
      {clientes.map((c) => (
        <Caixa
          como="li"
          key={c.clienteId}
          className="[contain-intrinsic-size:auto_72px] [content-visibility:auto]"
        >
          <LinhaDeCliente
            href={c.href}
            empresa={c.empresa}
            cnpj={formatarCnpj(c.cnpj)}
            detalhes={c.detalhes}
            acao={c.acao}
          />
        </Caixa>
      ))}
    </ListaComDivisores>
  );
}
