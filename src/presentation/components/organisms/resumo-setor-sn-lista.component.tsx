import Link from "next/link";

import { formatarCnpj } from "@/presentation/lib/cnpj-mask";

type Cliente = { clienteId: string; empresa: string; cnpj: string };

type Props = { clientes: Cliente[] };

// Lista filtrada de um bucket do resumo (#36) — abre como tela própria
// (/clientes/resumo/[bucket]), não mais inline no dashboard. Cada linha leva
// pra /clientes/[id] (#34), que já é a tela de edição/consulta do cadastro
// operacional — reusada em vez de duplicar o formulário aqui.
export function ResumoSetorSnLista({ clientes }: Props) {
  if (clientes.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum cliente neste status.</p>;
  }

  return (
    <ul className="divide-y divide-border rounded-md border border-border">
      {clientes.map((cliente) => (
        <li key={cliente.clienteId}>
          <Link
            href={`/clientes/${cliente.clienteId}`}
            className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-accent/50"
          >
            <div>
              <p className="font-medium text-foreground">{cliente.empresa}</p>
              <p className="text-sm text-muted-foreground">{formatarCnpj(cliente.cnpj)}</p>
            </div>
            <span className="text-sm text-muted-foreground">Ver cadastro →</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
