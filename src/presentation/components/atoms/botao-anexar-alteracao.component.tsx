import { Paperclip } from "lucide-react";

import { Button } from "@/presentation/components/ui/button";

// Abre o diálogo de anexar alteração (popover nativo) pelo id do painel; só o Admin o recebe.
export function BotaoAnexarAlteracao({ painelId }: { painelId: string }) {
  return (
    <Button type="button" variant="outline" popoverTarget={painelId}>
      <Paperclip className="size-4" aria-hidden="true" />
      Anexar alteração
    </Button>
  );
}
