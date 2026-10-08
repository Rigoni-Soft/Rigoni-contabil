import Link from "next/link";
import { MessageCircle } from "lucide-react";

type AtendimentoEmAndamentoView = { id: string; href: string; titulo: string; detalhe: string };

type AtendimentosEmAndamentoProps = { atendimentos: AtendimentoEmAndamentoView[] };

// Fica no canto de toda tela autenticada: o Funcionário troca de tela sem perder o Atendimento.
export function AtendimentosEmAndamento({ atendimentos }: AtendimentosEmAndamentoProps) {
  if (atendimentos.length === 0) return null;

  return (
    <nav
      aria-label="Atendimentos em andamento"
      className="fixed right-4 bottom-4 z-50 flex max-w-[calc(100vw-2rem)] flex-col gap-2 sm:max-w-xs"
    >
      {atendimentos.map((atendimento) => (
        <Link
          key={atendimento.id}
          href={atendimento.href}
          className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 shadow-md hover:bg-accent"
        >
          <MessageCircle aria-hidden="true" className="size-5 shrink-0 text-primary" />
          <span className="min-w-0">
            <span className="block truncate font-medium text-foreground">{atendimento.titulo}</span>
            <span className="block truncate text-sm text-muted-foreground">
              {atendimento.detalhe}
            </span>
          </span>
        </Link>
      ))}
    </nav>
  );
}
