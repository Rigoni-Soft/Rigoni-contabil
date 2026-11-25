import { AlertCircle, CheckCircle2, Clock } from "lucide-react";

import { cn } from "@/presentation/lib/utils";

type AvisoDeStatusProps = {
  tipo: "erro" | "sucesso" | "atencao";
  texto: React.ReactNode;
  legivel?: boolean;
  className?: string;
  id?: string;
  ref?: React.Ref<HTMLParagraphElement>;
  tabIndex?: number;
};

const POR_TIPO = {
  erro: { Icone: AlertCircle, cor: "text-destructive", role: "alert" },
  sucesso: { Icone: CheckCircle2, cor: "text-primary", role: "status" },
  atencao: { Icone: Clock, cor: "text-foreground", role: "status" },
} as const;

export function AvisoDeStatus({
  tipo,
  texto,
  legivel,
  className,
  id,
  ref,
  tabIndex,
}: AvisoDeStatusProps) {
  const { Icone, cor, role } = POR_TIPO[tipo];
  return (
    <p
      id={id}
      ref={ref}
      tabIndex={tabIndex}
      role={role}
      className={cn("flex items-start gap-1.5", legivel ? "text-sm" : "text-xs", cor, className)}
    >
      <Icone
        className={cn("size-3.5 shrink-0", legivel ? "mt-[3px]" : "mt-px")}
        aria-hidden="true"
      />
      <span>{texto}</span>
    </p>
  );
}
