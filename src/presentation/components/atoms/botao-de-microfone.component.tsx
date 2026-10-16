import { Mic } from "lucide-react";

import { Button } from "@/presentation/components/ui/button";

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
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Gravar áudio"
      title={motivo}
      aria-describedby={motivo ? motivoId : undefined}
      autoFocus={focarAoMontar}
      disabled={disabled || !!motivo}
      className="text-muted-foreground hover:text-foreground [&_svg]:size-5"
      onClick={onClick}
    >
      <Mic aria-hidden="true" />
    </Button>
  );
}
