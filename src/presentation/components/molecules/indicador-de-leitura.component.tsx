import { CheckCircle2, LoaderCircle, Pencil, type LucideIcon } from "lucide-react";

import { Texto } from "@/presentation/components/atoms/texto.component";
import { cn } from "@/presentation/lib/utils";

export type EstadoDeLeitura = "lendo" | "sugerido" | "falhou";

type IndicadorDeLeituraProps = {
  id: string;
  // Ausente: a região viva fica vazia (existe antes da leitura, para o leitor de tela anunciar a mudança).
  estado?: EstadoDeLeitura;
  texto?: string;
};

// Estado de resultado: ícone + texto + cor, nunca só cor (DESIGN.md "Indicadores de estado"), no
// mesmo desenho do selo do mês. Falhar a leitura não é erro (cai no "digite à mão"): neutro, sem destructive.
const ESTADO: Record<EstadoDeLeitura, { Icone: LucideIcon; classes: string; icone?: string }> = {
  lendo: { Icone: LoaderCircle, classes: "", icone: "motion-safe:animate-spin" },
  sugerido: { Icone: CheckCircle2, classes: "text-primary" },
  falhou: { Icone: Pencil, classes: "" },
};

export function IndicadorDeLeitura({ id, estado, texto }: IndicadorDeLeituraProps) {
  const exibido = estado && ESTADO[estado];
  return (
    <Texto
      variante="apoio"
      id={id}
      role="status"
      className={cn("flex items-start gap-1.5", exibido && exibido.classes)}
    >
      {exibido && (
        <exibido.Icone
          className={cn("mt-[3px] size-3.5 shrink-0", exibido.icone)}
          aria-hidden="true"
        />
      )}
      {texto}
    </Texto>
  );
}
