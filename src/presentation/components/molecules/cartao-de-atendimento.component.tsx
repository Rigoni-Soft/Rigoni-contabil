import Link from "next/link";
import { MessageCircle } from "lucide-react";

import { cn } from "@/presentation/lib/utils";

type CartaoDeAtendimentoProps = {
  href: string;
  titulo: string;
  detalhe: string;
  // Início da última mensagem da conversa.
  previa?: string | null;
  // O cliente escreveu por último e espera resposta: destaca o cartão.
  aguardando?: boolean;
};

// Entra deslizando de baixo (só para quem não pediu movimento reduzido).
export function CartaoDeAtendimento({
  href,
  titulo,
  detalhe,
  previa,
  aguardando = false,
}: CartaoDeAtendimentoProps) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-lg border bg-card px-3 py-2 shadow-md hover:bg-accent motion-safe:animate-dock-entrada",
        aguardando ? "border-primary" : "border-border",
      )}
    >
      <span className="relative shrink-0">
        <MessageCircle aria-hidden="true" className="size-5 text-primary" />
        {aguardando && (
          <span
            aria-hidden="true"
            className="absolute -top-1 -right-1 size-2.5 rounded-full bg-destructive"
          />
        )}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-medium text-foreground">
          {titulo}
          {aguardando && <span className="sr-only"> — nova mensagem</span>}
        </span>
        <span className="block truncate text-sm text-muted-foreground">{detalhe}</span>
        {previa && (
          <span
            className={cn(
              "block truncate text-xs",
              aguardando ? "font-medium text-foreground" : "text-muted-foreground",
            )}
          >
            {previa}
          </span>
        )}
      </span>
    </Link>
  );
}
