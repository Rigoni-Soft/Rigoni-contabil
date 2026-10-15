import { Caixa } from "@/presentation/components/atoms/caixa.component";
import { ListaComDivisores } from "@/presentation/components/atoms/lista-com-divisores.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { LinhaDeCliente } from "@/presentation/components/molecules/linha-de-cliente.component";
import { formatarCnpj } from "@/presentation/lib/cnpj-mask";

type Cliente = { clienteId: string; empresa: string; cnpj: string };

type Props = { clientes: Cliente[]; bucket: string };

// Lista filtrada de um bucket do resumo (#36) — abre como tela própria
// (/clientes/resumo/[bucket]). Cada linha leva pra /clientes/[id] (#34), a tela de
// edição/consulta do cadastro operacional; `voltarPara` manda a própria URL desta lista,
// pra "Voltar" na tela de edição trazer de volta pra cá, não pro dashboard.
export function ResumoSetorSnLista({ clientes, bucket }: Props) {
  if (clientes.length === 0) {
    return <Texto variante="apoio">Nenhum cliente neste status.</Texto>;
  }

  return (
    <ListaComDivisores>
      {clientes.map((cliente) => (
        <Caixa como="li" key={cliente.clienteId}>
          <LinhaDeCliente
            href={`/clientes/${cliente.clienteId}?voltarPara=/clientes/resumo/${bucket}`}
            empresa={cliente.empresa}
            cnpj={formatarCnpj(cliente.cnpj)}
          />
        </Caixa>
      ))}
    </ListaComDivisores>
  );
}
