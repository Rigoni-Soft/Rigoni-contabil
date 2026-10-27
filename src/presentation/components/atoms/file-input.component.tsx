import { FileText, Upload, X } from "lucide-react";

import { Button } from "@/presentation/components/ui/button";
import { cn } from "@/presentation/lib/utils";

type FileInputProps = {
  id: string;
  name?: string;
  accept?: string;
  file?: File;
  // Formato e limite, ditos antes de escolher (ex.: "PDF ou DOCX"), não só no erro depois.
  dica?: string;
  // Campo secundário (ex.: anexo opcional ao lado de um principal): área baixa, em linha, para não repetir o peso da primeira.
  compacto?: boolean;
  onChange: (file: File | undefined) => void;
  onBlur?: () => void;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

// Área de soltar arquivo, padrão de todo campo de arquivo do produto: clique abre o seletor do SO,
// arrastar e soltar entrega o arquivo. O <input type="file"> nativo fica sr-only dentro de um
// <label> que carrega a aparência (o label ainda aciona o seletor e o foco por teclado no input
// escondido acende o anel via `has-[:focus-visible]`). O tipo do arquivo solto não é filtrado aqui:
// quem valida (schema do formulário) mostra o erro, como para o arquivo escolhido pelo clique.
// O destaque de "arrastando" é um data-attribute (sem estado), e os filhos não recebem o ponteiro
// para o dragleave não disparar ao passar por cima do texto.
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
        {/* O nome do arquivo escolhido entra no nome acessível do campo (é o estado); as instruções de
          uso e a dica ficam fora dele (aria-hidden): o rótulo do campo já o nomeia, e ouvir
          "Contrato social, arraste o arquivo aqui, ou clique para selecionar, PDF ou DOCX" é ruído. */}
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
        <input
          id={id}
          name={name}
          type="file"
          accept={accept}
          className="sr-only"
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedby}
          onBlur={onBlur}
          onClick={(evento) => (evento.currentTarget.value = "")}
          onChange={(evento) => onChange(evento.target.files?.[0])}
        />
      </label>
      {/* Fora do <label>: o clique no botão não pode abrir o seletor. Escolheu o arquivo errado, tira. */}
      {file && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => onChange(undefined)}
        >
          <X aria-hidden="true" className="size-4" />
          Remover arquivo
        </Button>
      )}
    </>
  );
}
