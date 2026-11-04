import { cn } from "@/presentation/lib/utils";

type CelulaDeTabelaProps = {
  // Data/hora e números ficam em uma linha só e alinhados à direita (tabular-nums).
  numerica?: boolean;
  // Primeira coluna: fica à vista na rolagem horizontal.
  fixa?: boolean;
  children: React.ReactNode;
};

export function CelulaDeTabela({ numerica = false, fixa = false, children }: CelulaDeTabelaProps) {
  return (
    <td
      className={cn(
        "px-3 py-2",
        fixa && "sticky left-0 border-r border-border bg-card",
        numerica && "whitespace-nowrap text-right text-muted-foreground tabular-nums",
      )}
    >
      {children}
    </td>
  );
}

export function CabecalhoDeColuna({
  fixa = false,
  numerica = false,
  children,
}: {
  fixa?: boolean;
  // O cabeçalho acompanha o alinhamento à direita das células numéricas.
  numerica?: boolean;
  children: React.ReactNode;
}) {
  return (
    <th
      scope="col"
      className={cn(
        "px-3 py-2 font-medium",
        fixa && "sticky left-0 border-r border-border bg-muted",
        numerica && "text-right",
      )}
    >
      {children}
    </th>
  );
}

// Tabela com rolagem horizontal própria (a moldura não estoura a tela estreita).
export function Tabela({
  colunas,
  legenda,
  semMoldura = false,
  children,
}: {
  colunas: React.ReactNode;
  // Nome da tabela para leitor de tela.
  legenda?: string;
  // Dentro de um cartão, que já tem a moldura.
  semMoldura?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      // Região rolável: com legenda ganha nome e foco, para o teclado rolar a tabela.
      {...(legenda && { role: "region", "aria-label": legenda, tabIndex: 0 })}
      className={cn(
        "overflow-x-auto bg-card focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring",
        !semMoldura && "rounded-lg border border-border",
      )}
    >
      <table className="w-full text-left text-sm">
        {legenda && <caption className="sr-only">{legenda}</caption>}
        <thead className="border-b border-border bg-muted text-muted-foreground">
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
