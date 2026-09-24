import { AlertCircle } from "lucide-react";

import { cn } from "@/presentation/lib/utils";

type FieldErrorProps = { children: React.ReactNode; className?: string };

// Estado de erro marcado por ícone + cor, nunca só cor (contrato "Talão de Cheque").
export function FieldError({ children, className }: FieldErrorProps) {
  return (
    <p role="alert" className={cn("flex items-center gap-1.5 text-sm text-destructive", className)}>
      <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
      {children}
    </p>
  );
}
