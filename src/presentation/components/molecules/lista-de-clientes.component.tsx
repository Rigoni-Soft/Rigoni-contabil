import { Caixa } from "@/presentation/components/atoms/caixa.component";
import { ListaComDivisores } from "@/presentation/components/atoms/lista-com-divisores.component";
import { LinhaDeCliente } from "@/presentation/components/molecules/linha-de-cliente.component";
import { formatarCnpj } from "@/presentation/lib/cnpj-mask";

type Cliente = {
  clienteId: string;
  empresa: string;
  cnpj: string;
  // Para onde a linha leva (o cadastro operacional, já com o `voltarPara` de quem monta).
  href: string;
  // Dado extra do Cliente nesta lista (ex.: "3 meses", os selos de Parcelamento), abaixo da linha.
  detalhes?: React.ReactNode;
  // Troca o "Ver cadastro →" quando a linha leva a outra tela (ex.: "Abrir folha →").
  acao?: string;
};

// A lista de Clientes do padrão de drill-down (DESIGN.md): linhas com divisor, empresa em destaque,
// CNPJ mascarado e "Ver cadastro →".
export function ListaDeClientes({ clientes }: { clientes: Cliente[] }) {
  return (
    <ListaComDivisores>
      {clientes.map((c) => (
        // content-visibility: o navegador pula layout e pintura das linhas fora da tela (listas de
        // centenas de Clientes); o tamanho estimado vale até a linha ser desenhada uma vez.
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
