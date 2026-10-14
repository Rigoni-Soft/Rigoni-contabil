import { Mic } from "lucide-react";

import { cn } from "@/presentation/lib/utils";

type BotaoDeMicrofoneProps = {
  disabled?: boolean;
  // Por que não dá para gravar (navegador sem suporte, página sem HTTPS): vira a dica do botão.
  motivo?: string;
  onClick: () => void;
};

// Alvo de 44 px (DESIGN.md), mesmo desenho do clipe e do emoji.
export function BotaoDeMicrofone({ disabled, motivo, onClick }: BotaoDeMicrofoneProps) {
  return (
    <button
      type="button"
      aria-label="Gravar áudio"
      title={motivo}
      disabled={disabled || !!motivo}
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:pointer-events-none disabled:opacity-50",
      )}
      onClick={onClick}
    >
      <Mic className="size-5" aria-hidden="true" />
    </button>
  );
}
