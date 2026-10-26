import { CheckCircle2, Clock, Send } from "lucide-react";

import { Texto } from "@/presentation/components/atoms/texto.component";
import { cn } from "@/presentation/lib/utils";

// Estado da guia anexada: ícone + texto + cor, nunca só cor (DESIGN.md "Indicadores de estado"). Mesmo
// par do selo do Parcelamento: confirmada é `primary` (liberada ao envio); a confirmar é neutra.
// Enviada (registro de envio) vem depois de confirmada e prevalece: é o estado final da guia.
export function SeloDaGuia({ confirmada, enviada }: { confirmada: boolean; enviada?: boolean }) {
  const Icone = enviada ? Send : confirmada ? CheckCircle2 : Clock;
  return (
    <Texto
      variante="nota"
      como="span"
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium",
        enviada || confirmada
          ? "border-primary text-primary"
          : "border-border bg-muted text-foreground",
      )}
    >
      <Icone className="size-3" aria-hidden="true" />
      {enviada ? "Enviada" : confirmada ? "Confirmada" : "A confirmar"}
    </Texto>
  );
}
