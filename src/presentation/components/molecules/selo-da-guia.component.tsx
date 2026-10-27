import { CheckCircle2, Clock, Send } from "lucide-react";

import { Texto } from "@/presentation/components/atoms/texto.component";
import { cn } from "@/presentation/lib/utils";

// Estado da guia anexada: ícone + texto + cor, nunca só cor (DESIGN.md "Indicadores de estado"). Mesmo
// par do selo do Parcelamento: confirmada é `primary` (liberada ao envio); a confirmar é neutra.
// Enviada (registro de envio) vem depois de confirmada e prevalece: é o estado final da guia.
// 14 px, como as notas da lista de guias: é o estado que a pessoa lê para agir, não metadado.
const ESTADOS = {
  // Enviada é o marco final e irreversível: preenchida. Liberada ao envio ainda pode sair do fluxo: contorno.
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
