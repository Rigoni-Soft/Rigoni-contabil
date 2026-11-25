import { FileText, Upload, X } from "lucide-react";

import { Button } from "@/presentation/components/ui/button";
import { descricaoDoCampo } from "@/presentation/lib/descricao-do-campo";
import { cn } from "@/presentation/lib/utils";

type FileInputProps = {
  id: string;
  name?: string;
  accept?: string;
  file?: File;
  dica?: string;
  compacto?: boolean;
  onChange: (file: File | undefined) => void;
  onBlur?: () => void;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

const arrastando = (evento: React.DragEvent<HTMLLabelElement>, valor: boolean) => {
  evento.preventDefault();
  evento.currentTarget.dataset.arrastando = String(valor);
};

export function FileInput({
  id,
  name,
  accept,
  file,
  dica,
  compacto,
  onChange,
  onBlur,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedby,
}: FileInputProps) {
  return (
    <>
      <label
        htmlFor={id}
        onDragOver={(evento) => arrastando(evento, true)}
        onDragLeave={(evento) => arrastando(evento, false)}
        onDrop={(evento) => {
          arrastando(evento, false);
          onChange(evento.dataTransfer.files?.[0]);
        }}
        className={cn(
          "flex w-full cursor-pointer items-center justify-center rounded-md border border-dashed border-input bg-background px-3 py-3 text-center text-sm",
          compacto ? "min-h-14 flex-row flex-wrap gap-x-3 gap-y-1" : "min-h-28 flex-col gap-1",
          "transition-colors hover:bg-accent/50 data-[arrastando=true]:border-primary data-[arrastando=true]:bg-accent",
          "*:pointer-events-none",
          "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background",
          ariaInvalid && "border-destructive has-[:focus-visible]:ring-destructive",
        )}
      >
        {file ? (
          <FileText className="size-6 shrink-0 text-primary" aria-hidden="true" />
        ) : (
          <Upload className="size-6 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
        <span
          aria-hidden={file ? undefined : "true"}
          className={cn(
            "max-w-full truncate",
            file ? "font-medium text-foreground" : "text-muted-foreground",
          )}
        >
          {file ? file.name : "Arraste o arquivo aqui"}
        </span>
        <span aria-hidden="true" className="contents text-xs text-muted-foreground">
          <span>{file ? "Clique ou arraste para trocar" : "ou clique para selecionar"}</span>
          {dica && <span>{dica}</span>}
        </span>
        {dica && (
          <span id={`${id}-dica`} className="sr-only">
            {dica}
          </span>
        )}
        <input
          id={id}
          name={name}
          type="file"
          accept={accept}
          className="sr-only"
          aria-invalid={ariaInvalid}
          aria-describedby={descricaoDoCampo(ariaDescribedby, dica && `${id}-dica`)}
          onBlur={onBlur}
          onClick={(evento) => (evento.currentTarget.value = "")}
          onChange={(evento) => onChange(evento.target.files?.[0])}
        />
      </label>
      {file && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start pointer-coarse:min-h-11"
          aria-label={`Remover arquivo ${file.name}`}
          onClick={() => {
            onChange(undefined);
            document.getElementById(id)?.focus();
          }}
        >
          <X aria-hidden="true" className="size-4" />
          Remover arquivo
        </Button>
      )}
    </>
  );
}
