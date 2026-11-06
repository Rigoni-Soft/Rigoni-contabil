import { AlertCircle } from "lucide-react";

import { cn } from "@/presentation/lib/utils";

type FieldErrorProps = { children: React.ReactNode; className?: string; id?: string };

// Estado de erro marcado por ícone + cor, nunca só cor (contrato "Talão de Cheque").
export function FieldError({ children, className, id }: FieldErrorProps) {
  return (
    <p
      id={id}
      role="alert"
      className={cn("flex items-start gap-1.5 text-sm text-destructive", className)}
    >
      {/* mt-[3px]: centra o ícone (14 px) na primeira linha (20 px), também com texto quebrado. */}
      <AlertCircle className="mt-[3px] size-3.5 shrink-0" aria-hidden="true" />
      {children}
    </p>
  );
}
