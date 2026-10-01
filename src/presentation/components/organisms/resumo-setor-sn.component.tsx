import Link from "next/link";

// Tipo estrutural local (não importa o DTO do módulo clientes — view burra,
// arquitetura.md §3.4): qualquer objeto com este shape serve.
type Card = { id: string; titulo: string; cor: string; quantidade: number };

type Props = { cards: Card[]; totalClientes: number };

// Cores do protótipo aprovado (spec #24, link no corpo da issue): os valores
// --good/--warning/--critical do mockup batem exatamente com os hex de
// --primary/--success/--destructive deste projeto (mockup não usa um token
// âmbar separado, usa o próprio --success, que aqui é dourado, não verde).
// "Em dia" e "em andamento" usam a mesma tinta (--good == --primary no
// mockup) — mantido assim, é o que foi aprovado.
const CLASSES_POR_COR: Record<string, { anel: string }> = {
  em_dia: { anel: "stroke-primary" },
  atencao: { anel: "stroke-success" },
  urgente: { anel: "stroke-destructive" },
  informativo: { anel: "stroke-muted-foreground" },
  andamento: { anel: "stroke-primary" },
};

const RAIO = 26;
const CIRCUNFERENCIA = 2 * Math.PI * RAIO;

function Anel({
  quantidade,
  total,
  classe,
}: {
  quantidade: number;
  total: number;
  classe: string;
}) {
  const proporcao = total === 0 ? 0 : Math.max(0, Math.min(1, quantidade / total));
  const offset = CIRCUNFERENCIA * (1 - proporcao);
  return (
    <div className="relative size-16 shrink-0">
      <svg viewBox="0 0 68 68" className="size-16 -rotate-90">
        <circle cx="34" cy="34" r={RAIO} strokeWidth="8" className="fill-none stroke-border" />
        <circle
          cx="34"
          cy="34"
          r={RAIO}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={CIRCUNFERENCIA}
          strokeDashoffset={offset}
          className={`fill-none ${classe}`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xl font-bold text-foreground tabular-nums">{quantidade}</span>
      </div>
    </div>
  );
}

function Grupo({
  titulo,
  cards,
  totalClientes,
}: {
  titulo: string;
  cards: Card[];
  totalClientes: number;
}) {
  return (
    <div>
      <p className="mb-3 border-b border-border pb-2 text-sm font-bold tracking-wide text-foreground uppercase">
        {titulo}
      </p>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((card) => {
          const { anel } = CLASSES_POR_COR[card.cor] ?? CLASSES_POR_COR.informativo;
          return (
            <li key={card.id}>
              <Link
                href={`/clientes/resumo/${card.id}`}
                className="flex h-full flex-col items-center gap-3 rounded-xl border border-border bg-card p-4 text-center shadow-sm transition-colors hover:border-ring hover:bg-accent/50"
              >
                <Anel quantidade={card.quantidade} total={totalClientes} classe={anel} />
                <p className="text-sm font-semibold text-foreground">{card.titulo}</p>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// A ordem dos 9 cards é um invariante do mapper (resumo-setor-sn.mapper.spec.ts
// garante a ordem exata): os 5 primeiros são "Documentos e DAS", os 4
// últimos são "Parcelamento" — mesmos dois grupos do protótipo aprovado.
export function ResumoSetorSn({ cards, totalClientes }: Props) {
  return (
    <section className="space-y-6">
      <h2 className="text-xl font-bold text-foreground">Resumo do setor</h2>
      <Grupo titulo="Documentos e DAS" cards={cards.slice(0, 5)} totalClientes={totalClientes} />
      <Grupo titulo="Parcelamento" cards={cards.slice(5, 9)} totalClientes={totalClientes} />
    </section>
  );
}
