import { AlertCircle, CheckCircle2 } from "lucide-react";

import { cn } from "@/presentation/lib/utils";

type AvisoDeStatusProps = {
  tipo: "erro" | "sucesso";
  texto: React.ReactNode;
  className?: string;
};

// Erro é anunciado como alerta; sucesso, como status. Ícone + texto + cor, nunca só cor (DESIGN.md
// "Indicadores de estado"): sucesso é `primary`, não `success` (o dourado é do selo "em dia").
export function AvisoDeStatus({ tipo, texto, className }: AvisoDeStatusProps) {
  const Icone = tipo === "erro" ? AlertCircle : CheckCircle2;
  return (
    <p
      role={tipo === "erro" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-1.5 text-xs",
        tipo === "erro" ? "text-destructive" : "text-primary",
        className,
      )}
    >
      <Icone className="mt-px size-3.5 shrink-0" aria-hidden="true" />
      <span>{texto}</span>
    </p>
  );
}
