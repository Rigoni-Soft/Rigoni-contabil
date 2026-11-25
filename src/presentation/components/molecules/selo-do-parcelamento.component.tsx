import { CheckCircle2, Clock, type LucideIcon } from "lucide-react";

import { Texto } from "@/presentation/components/atoms/texto.component";
import { cn } from "@/presentation/lib/utils";

export type SeloDoParcelamento = "quitado" | "enviado" | "pendente";

const SELO: Record<SeloDoParcelamento, { rotulo: string; classes: string; Icone?: LucideIcon }> = {
  quitado: { rotulo: "Quitado", classes: "border-border text-muted-foreground" },
  enviado: {
    rotulo: "Enviado no mês",
    classes: "border-primary text-primary",
    Icone: CheckCircle2,
  },
  pendente: {
    rotulo: "Pendente no mês",
    classes: "border-border bg-muted text-foreground",
    Icone: Clock,
  },
};

export function SeloDeParcelamento({ selo }: { selo: SeloDoParcelamento }) {
  const { rotulo, classes, Icone } = SELO[selo];
  return (
    <Texto
      variante="nota"
      como="span"
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium",
        classes,
      )}
    >
      {Icone && <Icone className="size-3" aria-hidden="true" />}
      {rotulo}
    </Texto>
  );
}
