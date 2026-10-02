// Tipo estrutural local (view burra, arquitetura.md §3.4).
type Fatia = { id: string; rotulo: string; quantidade: number };
type Props = {
  comparativos: { das: Fatia[]; parcelamento: Fatia[]; atividade: Fatia[]; procuracao: Fatia[] };
  totalClientes: number;
};

// Só tokens existentes (sem token novo); atenção = destructive, como no #36.
// A cor nunca é o único canal: toda fatia aparece na legenda com rótulo e número.
const COR_POR_ID: Record<string, { fundo: string; traco: string }> = {
  enviado: { fundo: "bg-primary", traco: "stroke-primary" },
  vigente: { fundo: "bg-primary", traco: "stroke-primary" },
  pendente: { fundo: "bg-destructive", traco: "stroke-destructive" },
  vencida: { fundo: "bg-destructive", traco: "stroke-destructive" },
  pronto: { fundo: "bg-success", traco: "stroke-success" },
  sem_movimento: { fundo: "bg-muted-foreground", traco: "stroke-muted-foreground" },
  interno: { fundo: "bg-muted-foreground", traco: "stroke-muted-foreground" },
  ausente: { fundo: "bg-muted-foreground", traco: "stroke-muted-foreground" },
};
const COR_PADRAO = { fundo: "bg-primary", traco: "stroke-primary" };
const cor = (id: string) => COR_POR_ID[id] ?? COR_PADRAO;

const RAIO = 40;
const CIRCUNFERENCIA = 2 * Math.PI * RAIO;

function Legenda({ fatias }: { fatias: Fatia[] }) {
  return (
    <ul className="space-y-1 text-sm">
      {fatias.map((f) => (
        <li key={f.id} className="flex items-center gap-2">
          <span aria-hidden className={`size-3 shrink-0 rounded-sm ${cor(f.id).fundo}`} />
          <span className="text-foreground">{f.rotulo}</span>
          <span className="ml-auto font-semibold text-foreground tabular-nums">{f.quantidade}</span>
        </li>
      ))}
    </ul>
  );
}

function Grafico({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div
      role="group"
      aria-label={titulo}
      className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm"
    >
      <p className="text-sm font-bold tracking-wide text-foreground uppercase">{titulo}</p>
      {children}
    </div>
  );
}

function Donut({ titulo, fatias }: { titulo: string; fatias: Fatia[] }) {
  const total = fatias.reduce((soma, f) => soma + f.quantidade, 0);
  return (
    <Grafico titulo={titulo}>
      <div className="flex items-center gap-4">
        <div className="relative size-28 shrink-0">
          <svg viewBox="0 0 100 100" aria-hidden className="size-28 -rotate-90">
            <circle cx="50" cy="50" r={RAIO} strokeWidth="14" className="fill-none stroke-border" />
            {fatias
              .filter((f) => f.quantidade > 0)
              .map((f, i, visiveis) => {
                const comprimento = (f.quantidade / total) * CIRCUNFERENCIA;
                const offset = -visiveis
                  .slice(0, i)
                  .reduce((soma, v) => soma + (v.quantidade / total) * CIRCUNFERENCIA, 0);
                return (
                  <circle
                    key={f.id}
                    cx="50"
                    cy="50"
                    r={RAIO}
                    strokeWidth="14"
                    strokeDasharray={`${comprimento} ${CIRCUNFERENCIA - comprimento}`}
                    strokeDashoffset={offset}
                    className={`fill-none ${cor(f.id).traco}`}
                  />
                );
              })}
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xl font-bold text-foreground tabular-nums">{total}</span>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <Legenda fatias={fatias} />
        </div>
      </div>
    </Grafico>
  );
}

function Barras({
  titulo,
  fatias,
  totalClientes,
}: {
  titulo: string;
  fatias: Fatia[];
  totalClientes: number;
}) {
  return (
    <Grafico titulo={titulo}>
      <ul className="space-y-3">
        {fatias.map((f) => {
          const pct = totalClientes === 0 ? 0 : Math.min(100, (f.quantidade / totalClientes) * 100);
          return (
            <li key={f.id} className="space-y-1">
              <div className="flex text-sm">
                <span className="text-foreground">{f.rotulo}</span>
                <span className="ml-auto font-semibold text-foreground tabular-nums">
                  {f.quantidade}
                </span>
              </div>
              <div aria-hidden className="h-2 rounded-full bg-border">
                <div
                  className={`h-2 rounded-full ${cor(f.id).fundo}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground">
        Um cliente pode estar em mais de uma atividade no mês.
      </p>
    </Grafico>
  );
}

function BarraSegmentada({ titulo, fatias }: { titulo: string; fatias: Fatia[] }) {
  return (
    <Grafico titulo={titulo}>
      <div aria-hidden className="flex h-4 overflow-hidden rounded-full bg-border">
        {fatias
          .filter((f) => f.quantidade > 0)
          .map((f) => (
            <div key={f.id} className={cor(f.id).fundo} style={{ flexGrow: f.quantidade }} />
          ))}
      </div>
      <Legenda fatias={fatias} />
    </Grafico>
  );
}

export function ComparativosSn({ comparativos, totalClientes }: Props) {
  return (
    <section aria-labelledby="comparativos-titulo" className="space-y-4">
      <h2 id="comparativos-titulo" className="text-xl font-bold text-foreground">
        Comparativos
      </h2>
      <div className="grid gap-4 md:grid-cols-2">
        <Donut titulo="Status do DAS" fatias={comparativos.das} />
        <Donut titulo="Status do parcelamento" fatias={comparativos.parcelamento} />
        <Barras
          titulo="Atividade do mês"
          fatias={comparativos.atividade}
          totalClientes={totalClientes}
        />
        <BarraSegmentada titulo="Procuração eletrônica" fatias={comparativos.procuracao} />
      </div>
    </section>
  );
}
