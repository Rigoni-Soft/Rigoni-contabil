import { cn } from "@/presentation/lib/utils";

type CelulaDeTabelaProps = {
  // Célula de campo ou valor curto: menos respiro, para caber numa tabela de muitas colunas.
  compacta?: boolean;
  // Data/hora e números ficam em uma linha só e alinhados à direita (tabular-nums).
  numerica?: boolean;
  // Primeira coluna: fica à vista na rolagem horizontal e nomeia a linha (<th scope="row">).
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
        compacta ? "px-1.5 py-1" : "px-3 py-2",
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
  // Cabeçalho de grupo: cobre várias colunas (linha `agrupamento` da Tabela).
  colSpan?: number;
  fixa?: boolean;
  // O cabeçalho acompanha o alinhamento à direita das células numéricas.
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

// Tabela com rolagem horizontal própria (a moldura não estoura a tela estreita).
export function Tabela({
  colunas,
  legenda,
  semMoldura = false,
  grade = false,
  agrupamento,
  rodape,
  children,
}: {
  colunas: React.ReactNode;
  // Estilo planilha: divisória em toda célula e respiro menor (cabe mais coluna sem rolar).
  grade?: boolean;
  // Linha de cabeçalhos de grupo acima das colunas (CabecalhoDeColuna com `colSpan`).
  agrupamento?: React.ReactNode;
  // Linha(s) de totais, depois do corpo (células de `LinhaDeTabela`).
  rodape?: React.ReactNode;
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
        {rodape && <tfoot className="border-t border-border bg-muted font-medium">{rodape}</tfoot>}
      </table>
    </div>
  );
}

// Tom de fundo da linha (estado do dia, na planilha do cartão): tinta suave misturada ao cartão, opaca para a
// primeira coluna fixa não deixar o texto passar por baixo na rolagem.
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
