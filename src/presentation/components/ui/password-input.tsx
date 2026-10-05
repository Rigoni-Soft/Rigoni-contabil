"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { Input } from "@/presentation/components/ui/input";

// aria-label sem a palavra "senha" de propósito: os e2e localizam os campos por
// getByLabel("Senha"), que casa por substring e ficaria ambíguo com o botão.
export function PasswordInput(props: Omit<React.ComponentProps<typeof Input>, "type">) {
  const [visivel, setVisivel] = useState(false);
  const Icone = visivel ? EyeOff : Eye;

  return (
    <div className="relative">
      <Input {...props} type={visivel ? "text" : "password"} className="pr-11" />
      <button
        type="button"
        onClick={() => setVisivel((v) => !v)}
        aria-label={visivel ? "Ocultar caracteres" : "Mostrar caracteres"}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Icone className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
