"use client";

import { useEffect, useState } from "react";
import { Menu } from "lucide-react";

import { Button } from "@/presentation/components/ui/button";

// O botão que abre o menu do cabeçalho no celular: `alvoId` é o painel (popover nativo) que ele
// controla. O navegador abre, fecha (Esc, clique fora) e devolve o foco; aqui só se espelha o estado
// em `aria-expanded`, pelo evento `toggle` do painel.
export function BotaoDoMenu({ alvoId, className }: { alvoId: string; className?: string }) {
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    const alvo = document.getElementById(alvoId);
    if (!alvo) return;
    const aoAlternar = (evento: Event) =>
      setAberto((evento as Event & { newState?: string }).newState === "open");
    alvo.addEventListener("toggle", aoAlternar);
    return () => alvo.removeEventListener("toggle", aoAlternar);
  }, [alvoId]);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Menu"
      aria-expanded={aberto}
      aria-controls={alvoId}
      popoverTarget={alvoId}
      className={className}
    >
      <Menu aria-hidden="true" />
    </Button>
  );
}
