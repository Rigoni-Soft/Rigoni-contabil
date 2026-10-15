const RAIO = 26;
const CIRCUNFERENCIA = 2 * Math.PI * RAIO;

type AnelDeProgressoProps = {
  quantidade: number;
  total: number;
  // Classe `stroke-*` do traço (cor semântica do status).
  classe: string;
};

// Anel proporcional a quantidade/total, com a quantidade no centro.
export function AnelDeProgresso({ quantidade, total, classe }: AnelDeProgressoProps) {
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
