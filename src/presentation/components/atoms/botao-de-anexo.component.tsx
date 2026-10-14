import { Paperclip } from "lucide-react";

import { BOTAO_DE_ICONE } from "@/presentation/lib/botao-de-icone";
import { cn } from "@/presentation/lib/utils";

type BotaoDeAnexoProps = {
  // Tipos que o seletor do sistema oferece (`accept`).
  aceitar: string;
  disabled?: boolean;
  onEscolher: (arquivo: File) => void;
};

// Clipe: o <label> carrega a aparência de botão e aciona o seletor de arquivos do sistema; o input
// fica sr-only (mesmo padrão do FileInput, com alvo de 44 px).
export function BotaoDeAnexo({ aceitar, disabled, onEscolher }: BotaoDeAnexoProps) {
  return (
    <label
      className={cn(
        BOTAO_DE_ICONE,
        "cursor-pointer",
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
          // Esvazia para que escolher o mesmo arquivo de novo (depois de remover) dispare onChange.
          evento.target.value = "";
          if (arquivo) onEscolher(arquivo);
        }}
      />
    </label>
  );
}
