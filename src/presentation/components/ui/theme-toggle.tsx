"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/presentation/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // resolvedTheme só existe depois do mount; até lá assume dark (padrão do
  // produto). suppressHydrationWarning cobre o único frame em que o ícone
  // pode divergir do tema persistido do visitante.
  const escuro = resolvedTheme !== "light";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={escuro ? "Mudar para tema claro" : "Mudar para tema escuro"}
      onClick={() => setTheme(escuro ? "light" : "dark")}
    >
      <span suppressHydrationWarning>
        {escuro ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
      </span>
    </Button>
  );
}
