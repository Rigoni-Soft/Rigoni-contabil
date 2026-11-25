import { CheckCircle2, Clock, Send } from "lucide-react";

import { Texto } from "@/presentation/components/atoms/texto.component";
import { cn } from "@/presentation/lib/utils";

const ESTADOS = {
  enviada: {
    Icone: Send,
    texto: "Enviada",
    classes: "border-primary bg-primary text-primary-foreground",
  },
  confirmada: {
    Icone: CheckCircle2,
    texto: "Liberada ao envio",
    classes: "border-primary text-primary",
  },
  a_confirmar: {
    Icone: Clock,
    texto: "A confirmar",
    classes: "border-border bg-muted text-foreground",
  },
} as const;

export function SeloDaGuia({ confirmada, enviada }: { confirmada: boolean; enviada?: boolean }) {
  const { Icone, texto, classes } =
    ESTADOS[enviada ? "enviada" : confirmada ? "confirmada" : "a_confirmar"];
  return (
    <Texto
      variante="nota"
      como="span"
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm font-medium",
        classes,
      )}
    >
      <Icone className="size-3.5" aria-hidden="true" />
      {texto}
    </Texto>
  );
}
