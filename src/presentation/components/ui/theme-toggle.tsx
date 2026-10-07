"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/presentation/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // Antes do mount assume o padrão do produto (light), igual ao que o provider
  // entrega no primeiro render do cliente. suppressHydrationWarning no botão
  // (aria-label) e no span (ícone) cobre só o frame em que um visitante com
  // dark salvo diverge do padrão; fora disso o mismatch refazia a árvore no
  // cliente e apagava o que o usuário digitava durante a hidratação.
  const escuro = resolvedTheme === "dark";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      suppressHydrationWarning
      aria-label={escuro ? "Mudar para tema claro" : "Mudar para tema escuro"}
      onClick={() => setTheme(escuro ? "light" : "dark")}
    >
      <span suppressHydrationWarning>
        {escuro ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
      </span>
    </Button>
  );
}
