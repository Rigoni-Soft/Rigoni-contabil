import { CheckCircle2, LoaderCircle, Pencil, type LucideIcon } from "lucide-react";

import { Texto } from "@/presentation/components/atoms/texto.component";
import { cn } from "@/presentation/lib/utils";

export type EstadoDeLeitura = "lendo" | "sugerido" | "falhou";

type IndicadorDeLeituraProps = {
  id: string;
  estado?: EstadoDeLeitura;
  texto?: string;
};

const ESTADO: Record<EstadoDeLeitura, { Icone: LucideIcon; classes?: string }> = {
  lendo: { Icone: LoaderCircle },
  sugerido: { Icone: CheckCircle2, classes: "text-primary" },
  falhou: { Icone: Pencil },
};

export function IndicadorDeLeitura({ id, estado, texto }: IndicadorDeLeituraProps) {
  const exibido = estado && ESTADO[estado];
  return (
    <Texto
      variante="apoio"
      id={id}
      role="status"
      className={cn("flex items-start gap-1.5", exibido?.classes)}
    >
      {exibido && (
        <exibido.Icone
          className={cn(
            "mt-[3px] size-3.5 shrink-0",
            estado === "lendo" && "motion-safe:animate-spin",
          )}
          aria-hidden="true"
        />
      )}
      {texto}
    </Texto>
  );
}
