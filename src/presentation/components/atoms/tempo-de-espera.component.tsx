import { Clock } from "lucide-react";

export function TempoDeEspera({ valor }: { valor: string }) {
  return (
    <span className="flex shrink-0 items-center gap-1 text-sm text-foreground tabular-nums">
      <Clock aria-hidden="true" className="size-4 text-muted-foreground" />
      <span className="sr-only">Esperando há </span>
      <span>{valor}</span>
    </span>
  );
}
