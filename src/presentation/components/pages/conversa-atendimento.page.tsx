import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type ConversaAtendimentoPageProps = { header: React.ReactNode; conversa: React.ReactNode };

export function ConversaAtendimentoPage({ header, conversa }: ConversaAtendimentoPageProps) {
  return (
    <main className="min-h-screen bg-background">
      {header}
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Voltar
        </Link>
        {conversa}
      </div>
    </main>
  );
}
