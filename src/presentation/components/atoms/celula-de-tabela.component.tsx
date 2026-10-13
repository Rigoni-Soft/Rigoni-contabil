import { cn } from "@/presentation/lib/utils";

type CelulaDeTabelaProps = {
  // Data/hora e números ficam em uma linha só e alinhados (tabular-nums).
  numerica?: boolean;
  children: React.ReactNode;
};

export function CelulaDeTabela({ numerica = false, children }: CelulaDeTabelaProps) {
  return (
    <td
      className={cn(
        "px-3 py-2",
        numerica && "whitespace-nowrap text-muted-foreground tabular-nums",
      )}
    >
      {children}
    </td>
  );
}

export function CabecalhoDeColuna({ children }: { children: React.ReactNode }) {
  return (
    <th scope="col" className="px-3 py-2 font-medium">
      {children}
    </th>
  );
}

// Tabela com rolagem horizontal própria (a moldura não estoura a tela estreita).
export function Tabela({
  colunas,
  children,
}: {
  colunas: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border bg-muted/50 text-muted-foreground">
          <tr>{colunas}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function LinhaDeTabela({ children }: { children: React.ReactNode }) {
  return <tr className="border-b border-border last:border-0">{children}</tr>;
}
