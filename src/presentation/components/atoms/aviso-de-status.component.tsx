import { AlertCircle, CheckCircle2, Clock } from "lucide-react";

import { cn } from "@/presentation/lib/utils";

type AvisoDeStatusProps = {
  tipo: "erro" | "sucesso" | "atencao";
  texto: React.ReactNode;
  className?: string;
};

// Erro é anunciado como alerta; sucesso e atenção, como status. Ícone + texto + cor, nunca só cor
// (DESIGN.md "Indicadores de estado"): sucesso é `primary`, não `success` (o dourado é do selo "em
// dia"). Atenção é o que não falhou nem terminou, algo que pede conferência: `Clock` em cor neutra,
// o mesmo par do selo "A confirmar".
const POR_TIPO = {
  erro: { Icone: AlertCircle, cor: "text-destructive", role: "alert" },
  sucesso: { Icone: CheckCircle2, cor: "text-primary", role: "status" },
  atencao: { Icone: Clock, cor: "text-foreground", role: "status" },
} as const;

export function AvisoDeStatus({ tipo, texto, className }: AvisoDeStatusProps) {
  const { Icone, cor, role } = POR_TIPO[tipo];
  return (
    <p role={role} className={cn("flex items-start gap-1.5 text-xs", cor, className)}>
      <Icone className="mt-px size-3.5 shrink-0" aria-hidden="true" />
      <span>{texto}</span>
    </p>
  );
}
