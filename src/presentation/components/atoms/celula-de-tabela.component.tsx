import { cn } from "@/presentation/lib/utils";

type CelulaDeTabelaProps = {
  compacta?: boolean;
  numerica?: boolean;
  fixa?: boolean;
  children: React.ReactNode;
};

export function CelulaDeTabela({
  numerica = false,
  fixa = false,
  compacta = false,
  children,
}: CelulaDeTabelaProps) {
  const Elemento = fixa ? "th" : "td";
  return (
    <Elemento
      scope={fixa ? "row" : undefined}
      className={cn(
        "px-3",
        compacta ? "py-1" : "py-2",
        fixa && "sticky left-0 border-r border-border bg-inherit text-left font-normal",
        numerica && "text-right whitespace-nowrap text-muted-foreground tabular-nums",
      )}
    >
      {children}
    </Elemento>
  );
}

export function CabecalhoDeColuna({
  fixa = false,
  numerica = false,
  centro = false,
  colSpan,
  children,
}: {
  centro?: boolean;
  colSpan?: number;
  fixa?: boolean;
  numerica?: boolean;
  children: React.ReactNode;
}) {
  return (
    <th
      scope={colSpan ? "colgroup" : "col"}
      colSpan={colSpan}
      className={cn(
        "px-3 py-2 font-medium",
        centro && "text-center",
        fixa && "sticky left-0 border-r border-border bg-muted",
        numerica && "text-right",
      )}
    >
      {children}
    </th>
  );
}

export function Tabela({
  colunas,
  legenda,
  semMoldura = false,
  grade = false,
  agrupamento,
  children,
}: {
  colunas: React.ReactNode;
  grade?: boolean;
  agrupamento?: React.ReactNode;
  legenda?: string;
  semMoldura?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      {...(legenda && { role: "region", "aria-label": legenda, tabIndex: 0 })}
      className={cn(
        "overflow-x-auto bg-card focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
        !semMoldura && "rounded-lg border border-border",
      )}
    >
      <table
        className={cn(
          "w-full text-left text-sm",
          grade &&
            "border-collapse [&_td]:border [&_td]:border-border [&_td]:px-1.5 [&_th]:border [&_th]:border-border [&_th]:px-1.5",
        )}
      >
        {legenda && <caption className="sr-only">{legenda}</caption>}
        <thead className="border-b border-border bg-muted text-muted-foreground">
          {agrupamento && <tr>{agrupamento}</tr>}
          <tr>{colunas}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

const TOM = {
  alerta: "bg-[color-mix(in_oklab,var(--destructive)_9%,var(--card))]",
  atencao: "bg-[color-mix(in_oklab,var(--warning)_16%,var(--card))]",
  info: "bg-[color-mix(in_oklab,var(--info)_11%,var(--card))]",
} as const;

export function LinhaDeTabela({
  tom,
  children,
}: {
  tom?: keyof typeof TOM;
  children: React.ReactNode;
}) {
  return (
    <tr className={cn("border-b border-border bg-card last:border-0", tom && TOM[tom])}>
      {children}
    </tr>
  );
}
