import { AlertCircle } from "lucide-react";

import { cn } from "@/presentation/lib/utils";

type FieldErrorProps = { children: React.ReactNode; className?: string; id?: string };

export function FieldError({ children, className, id }: FieldErrorProps) {
  return (
    <p
      id={id}
      role="alert"
      className={cn("flex items-start gap-1.5 text-sm text-destructive", className)}
    >
      <AlertCircle className="mt-[3px] size-3.5 shrink-0" aria-hidden="true" />
      {children}
    </p>
  );
}
