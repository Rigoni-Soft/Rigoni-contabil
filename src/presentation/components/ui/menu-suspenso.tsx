"use client";

import { cn } from "@/presentation/lib/utils";

type MenuSuspensoProps = {
  // Nome do botão para leitor de tela; o `icone` é o único conteúdo visível dele.
  rotulo: string;
  icone: React.ReactNode;
  className?: string;
  children: React.ReactNode;
};

// ponytail: <details> nativo: fecha pelo botão, com Esc (o foco volta ao botão) ou ao navegar; fechar ao
// clicar fora pede um popover com posição própria.
export function MenuSuspenso({ rotulo, icone, className, children }: MenuSuspensoProps) {
  return (
    <details
      className={cn("relative", className)}
      onKeyDown={(e) => {
        if (e.key !== "Escape" || !e.currentTarget.open) return;
        e.currentTarget.open = false;
        e.currentTarget.querySelector("summary")?.focus();
      }}
    >
      <summary
        aria-label={rotulo}
        className="inline-flex size-9 cursor-pointer list-none items-center justify-center rounded-md border border-border text-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring pointer-coarse:size-11 [&::-webkit-details-marker]:hidden"
      >
        {icone}
      </summary>
      <div className="absolute top-full right-0 z-10 mt-1 min-w-56 rounded-lg border border-border bg-card p-1 shadow-md">
        {children}
      </div>
    </details>
  );
}
