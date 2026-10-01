import { Button } from "@/presentation/components/ui/button";
import { formatarCnpj } from "@/presentation/lib/cnpj-mask";

// Tipo estrutural local (não importa o DTO do módulo clientes — view burra,
// arquitetura.md §3.4): qualquer objeto com este shape serve, inclusive o
// CardResumoSnDto real que o Container passa.
type Card = {
  id: string;
  titulo: string;
  cor: string;
  quantidade: number;
  clientes: { clienteId: string; empresa: string; cnpj: string }[];
};

type Props = {
  cards: Card[];
  totalClientes: number;
  bucketAberto: string | null;
  onAbrirBucket: (id: string) => void;
  onSelecionarCliente: (clienteId: string) => void;
};

// Tabela de cores da spec #24, mapeada pros tokens do design system. A spec
// distingue "atenção" (âmbar) de "urgente" (vermelho), mas a identidade
// visual do projeto ("Talão de Cheque", ver globals.css) já decidiu usar a
// mesma tinta vermelha pros dois — não existe token âmbar aprovado, e
// inventar um aqui contradiria essa decisão. Os dois buckets continuam
// distintos pelo texto do card, não pela cor.
const CLASSES_POR_COR: Record<string, { texto: string; barra: string }> = {
  em_dia: { texto: "text-success", barra: "bg-success" },
  atencao: { texto: "text-destructive", barra: "bg-destructive" },
  urgente: { texto: "text-destructive", barra: "bg-destructive" },
  informativo: { texto: "text-muted-foreground", barra: "bg-muted-foreground" },
  andamento: { texto: "text-primary", barra: "bg-primary" },
};

function percentual(quantidade: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((quantidade / total) * 100);
}

export function ResumoSetorSn({
  cards,
  totalClientes,
  bucketAberto,
  onAbrirBucket,
  onSelecionarCliente,
}: Props) {
  const cardAberto = cards.find((c) => c.id === bucketAberto) ?? null;

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">Resumo do setor</h2>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const { texto, barra } = CLASSES_POR_COR[card.cor] ?? CLASSES_POR_COR.informativo;
          const aberto = card.id === bucketAberto;
          return (
            <li key={card.id}>
              <button
                type="button"
                onClick={() => onAbrirBucket(card.id)}
                aria-expanded={aberto}
                className={`w-full rounded-md border p-3 text-left transition-colors ${
                  aberto ? "border-ring bg-accent" : "border-border bg-card hover:bg-accent/50"
                }`}
              >
                <p className="text-sm font-medium text-foreground">{card.titulo}</p>
                <p className={`text-2xl font-semibold ${texto}`}>
                  {totalClientes === 0 ? "0 de 0" : `${card.quantidade} de ${totalClientes}`}
                </p>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full ${barra}`}
                    style={{ width: `${percentual(card.quantidade, totalClientes)}%` }}
                  />
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      {cardAberto && (
        <div className="space-y-2 rounded-md border border-border p-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-medium text-foreground">{cardAberto.titulo}</h3>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onAbrirBucket(cardAberto.id)}
            >
              Fechar
            </Button>
          </div>
          {cardAberto.clientes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum cliente neste status.</p>
          ) : (
            <ul className="divide-y divide-border">
              {cardAberto.clientes.map((cliente) => (
                <li
                  key={cliente.clienteId}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <div>
                    <p className="font-medium text-foreground">{cliente.empresa}</p>
                    <p className="text-sm text-muted-foreground">{formatarCnpj(cliente.cnpj)}</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onSelecionarCliente(cliente.clienteId)}
                  >
                    Ver cadastro
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
