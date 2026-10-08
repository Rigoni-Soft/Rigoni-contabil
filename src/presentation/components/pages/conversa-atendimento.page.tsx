import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type ConversaAtendimentoPageProps = { header: React.ReactNode; conversa: React.ReactNode };

// Em tela larga a página ocupa exatamente a altura da janela e não rola; quem rola é só a lista de
// mensagens, dentro da conversa. Em tela estreita volta a ser uma página comum.
export function ConversaAtendimentoPage({ header, conversa }: ConversaAtendimentoPageProps) {
  return (
    <main className="flex min-h-screen flex-col bg-background lg:h-dvh lg:min-h-0 lg:overflow-hidden">
      {header}
      <div className="flex min-h-0 flex-1 flex-col px-4 py-3 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="mb-2 inline-flex shrink-0 items-center gap-1.5 self-start text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Voltar
        </Link>
        <div className="min-h-0 flex-1">{conversa}</div>
      </div>
    </main>
  );
}
