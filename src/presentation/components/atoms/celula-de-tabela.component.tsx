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
