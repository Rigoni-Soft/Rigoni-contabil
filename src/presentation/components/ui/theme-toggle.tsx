"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/presentation/components/ui/button";

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const escuro = resolvedTheme === "dark";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={className}
      suppressHydrationWarning
      aria-label={escuro ? "Mudar para tema claro" : "Mudar para tema escuro"}
      onClick={() => setTheme(escuro ? "light" : "dark")}
    >
      <span suppressHydrationWarning>
        {escuro ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
      </span>
      <span suppressHydrationWarning className="hidden max-sm:inline">
        {escuro ? "Tema claro" : "Tema escuro"}
      </span>
    </Button>
  );
}
