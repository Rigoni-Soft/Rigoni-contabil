import { FileText, Upload } from "lucide-react";

import { cn } from "@/presentation/lib/utils";

type FileInputProps = {
  id: string;
  name?: string;
  accept?: string;
  file?: File;
  onChange: (file: File | undefined) => void;
  onBlur?: () => void;
  "aria-invalid"?: boolean;
};

// Mesmo contrato visual de input.tsx/select.tsx (44px, borda, foco, erro) —
// o <input type="file"> nativo não aceita ser estilizado diretamente, então
// fica sr-only dentro de um <label> que carrega a aparência (padrão
// acessível: o label ainda aciona o seletor de arquivo do SO, e o foco por
// teclado no input escondido acende o anel via `has-[:focus-visible]`).
export function FileInput({
  id,
  name,
  accept,
  file,
  onChange,
  onBlur,
  "aria-invalid": ariaInvalid,
}: FileInputProps) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex h-11 w-full cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 text-base sm:text-sm",
        "transition-colors hover:bg-accent/50",
        "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background",
        ariaInvalid && "border-destructive has-[:focus-visible]:ring-destructive",
      )}
    >
      {file ? (
        <FileText className="size-4 shrink-0 text-primary" aria-hidden="true" />
      ) : (
        <Upload className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      )}
      <span className={cn("truncate", file ? "text-foreground" : "text-muted-foreground")}>
        {file ? file.name : "Selecionar arquivo…"}
      </span>
      <input
        id={id}
        name={name}
        type="file"
        accept={accept}
        className="sr-only"
        aria-invalid={ariaInvalid}
        onBlur={onBlur}
        onChange={(evento) => onChange(evento.target.files?.[0])}
      />
    </label>
  );
}
