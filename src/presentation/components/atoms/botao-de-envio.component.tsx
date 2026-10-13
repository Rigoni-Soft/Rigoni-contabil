import { Loader2 } from "lucide-react";

import { Button } from "@/presentation/components/ui/button";

type BotaoDeEnvioProps = { pendente: boolean; rotulo: string; rotuloPendente: string };

// Botão de submit com spinner enquanto o envio está pendente.
export function BotaoDeEnvio({ pendente, rotulo, rotuloPendente }: BotaoDeEnvioProps) {
  return (
    <Button type="submit" disabled={pendente}>
      {pendente && <Loader2 className="motion-safe:animate-spin" aria-hidden="true" />}
      {pendente ? rotuloPendente : rotulo}
    </Button>
  );
}
