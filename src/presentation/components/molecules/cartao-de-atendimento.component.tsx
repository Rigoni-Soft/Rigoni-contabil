import Link from "next/link";
import { MessageCircle } from "lucide-react";

type CartaoDeAtendimentoProps = { href: string; titulo: string; detalhe: string };

export function CartaoDeAtendimento({ href, titulo, detalhe }: CartaoDeAtendimentoProps) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 shadow-md hover:bg-accent"
    >
      <MessageCircle aria-hidden="true" className="size-5 shrink-0 text-primary" />
      <span className="min-w-0">
        <span className="block truncate font-medium text-foreground">{titulo}</span>
        <span className="block truncate text-sm text-muted-foreground">{detalhe}</span>
      </span>
    </Link>
  );
}
