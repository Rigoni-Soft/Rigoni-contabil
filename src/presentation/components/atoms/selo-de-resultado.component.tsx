import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

import { cn } from "@/presentation/lib/utils";

// Resultado de uma ação: ícone + texto + cor, nunca só cor. "falha_compensacao" ganha ícone próprio:
// ao contrário de uma falha comum, pode ter deixado estado inconsistente que exige reconciliação.
export function SeloDeResultado({ resultado }: { resultado: string }) {
  const sucesso = resultado === "sucesso";
  const Icone = sucesso
    ? CheckCircle2
    : resultado === "falha_compensacao"
      ? AlertTriangle
      : XCircle;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5",
        sucesso ? "text-primary" : "text-destructive",
      )}
    >
      <Icone className="size-3.5 shrink-0" aria-hidden="true" />
      {resultado}
    </span>
  );
}
