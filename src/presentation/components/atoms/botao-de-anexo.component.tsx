import { Paperclip } from "lucide-react";

import { cn } from "@/presentation/lib/utils";

type BotaoDeAnexoProps = {
  aceitar: string;
  disabled?: boolean;
  onEscolher: (arquivo: File) => void;
};

export function BotaoDeAnexo({ aceitar, disabled, onEscolher }: BotaoDeAnexoProps) {
  return (
    <label
      className={cn(
        "flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
        "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      <Paperclip className="size-5" aria-hidden="true" />
      <span className="sr-only">Anexar arquivo</span>
      <input
        type="file"
        accept={aceitar}
        disabled={disabled}
        className="sr-only"
        onChange={(evento) => {
          const arquivo = evento.target.files?.[0];
          evento.target.value = "";
          if (arquivo) onEscolher(arquivo);
        }}
      />
    </label>
  );
}
