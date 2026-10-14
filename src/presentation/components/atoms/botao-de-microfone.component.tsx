import { Mic } from "lucide-react";

import { BOTAO_DE_ICONE } from "@/presentation/lib/botao-de-icone";
import { cn } from "@/presentation/lib/utils";

type BotaoDeMicrofoneProps = {
  disabled?: boolean;
  // Por que não dá para gravar (navegador sem suporte, página sem HTTPS): vira a dica do botão.
  motivo?: string;
  // Id do texto que escreve o motivo, para o leitor de tela ligá-lo ao botão desligado.
  motivoId?: string;
  // Ao montar, recebe o foco: o botão que o usuário acionou saiu da tela durante a gravação.
  focarAoMontar?: boolean;
  onClick: () => void;
};

// Alvo de 44 px (DESIGN.md), mesmo desenho do clipe e do emoji.
export function BotaoDeMicrofone({
  disabled,
  motivo,
  motivoId,
  focarAoMontar,
  onClick,
}: BotaoDeMicrofoneProps) {
  return (
    <button
      type="button"
      aria-label="Gravar áudio"
      title={motivo}
      aria-describedby={motivo ? motivoId : undefined}
      autoFocus={focarAoMontar}
      disabled={disabled || !!motivo}
      className={cn(
        BOTAO_DE_ICONE,
        "outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:pointer-events-none disabled:opacity-50",
      )}
      onClick={onClick}
    >
      <Mic className="size-5" aria-hidden="true" />
    </button>
  );
}
