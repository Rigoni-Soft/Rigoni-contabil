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
const CLASSES_POR_COR: Record<string, { texto: string; anel: string }> = {
  em_dia: { texto: "text-primary", anel: "stroke-primary" },
  atencao: { texto: "text-success", anel: "stroke-success" },
  urgente: { texto: "text-destructive", anel: "stroke-destructive" },
  informativo: { texto: "text-muted-foreground", anel: "stroke-muted-foreground" },
  andamento: { texto: "text-primary", anel: "stroke-primary" },
};

const RAIO = 24;
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
    <div className="relative size-[62px] shrink-0">
      <svg viewBox="0 0 62 62" className="size-[62px] -rotate-90">
        <circle cx="31" cy="31" r={RAIO} strokeWidth="7" className="fill-none stroke-border" />
        <circle
          cx="31"
          cy="31"
          r={RAIO}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={CIRCUNFERENCIA}
          strokeDashoffset={offset}
          className={`fill-none ${classe}`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[15px] font-bold text-foreground tabular-nums">{quantidade}</span>
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
      <p className="mb-2 text-xs font-semibold text-muted-foreground">{titulo}</p>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((card) => {
          const { texto, anel } = CLASSES_POR_COR[card.cor] ?? CLASSES_POR_COR.informativo;
          return (
            <li key={card.id}>
              <Link
                href={`/clientes/resumo/${card.id}`}
                className="flex h-full flex-col gap-2 rounded-xl border border-border bg-card p-3 shadow-sm transition-colors hover:border-ring hover:bg-accent/50"
              >
                <p className="text-[13px] font-semibold text-foreground">{card.titulo}</p>
                <div className="flex items-center gap-2.5">
                  <Anel quantidade={card.quantidade} total={totalClientes} classe={anel} />
                  <p className={`text-[11px] ${texto}`}>de {totalClientes}</p>
                </div>
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
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Resumo do setor</h2>
      <Grupo titulo="Documentos e DAS" cards={cards.slice(0, 5)} totalClientes={totalClientes} />
      <Grupo titulo="Parcelamento" cards={cards.slice(5, 9)} totalClientes={totalClientes} />
    </section>
  );
}
