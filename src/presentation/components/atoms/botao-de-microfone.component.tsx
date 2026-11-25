import { Mic } from "lucide-react";

import { Button } from "@/presentation/components/ui/button";

type BotaoDeMicrofoneProps = {
  disabled?: boolean;
  motivo?: string;
  motivoId?: string;
  focarAoMontar?: boolean;
  onClick: () => void;
};

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
