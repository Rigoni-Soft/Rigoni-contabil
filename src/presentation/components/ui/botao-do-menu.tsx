"use client";

import { Menu } from "lucide-react";

import { Button } from "@/presentation/components/ui/button";
import { useMenuDoShell } from "@/presentation/hooks/use-menu-do-shell.hook";

// O botão que abre o menu do cabeçalho no celular: `alvoId` é o painel (popover) que ele controla.
export function BotaoDoMenu({ alvoId, className }: { alvoId: string; className?: string }) {
  const { aberto, aoClicar } = useMenuDoShell(alvoId);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Menu"
      aria-expanded={aberto}
      aria-controls={alvoId}
      popoverTarget={alvoId}
      data-botao-do-menu=""
      className={className}
      onClick={aoClicar}
    >
      <Menu aria-hidden="true" />
    </Button>
  );
}
