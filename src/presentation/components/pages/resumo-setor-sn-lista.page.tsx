import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type Props = { header: React.ReactNode; titulo: string; lista: React.ReactNode };

export function ResumoSetorSnListaPage({ header, titulo, lista }: Props) {
  return (
    <main className="min-h-screen bg-background">
      {header}
      <div className="mx-auto w-[90%] px-4 py-8 sm:px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Voltar ao resumo
        </Link>
        <h1 className="mt-3 mb-6 text-xl font-bold tracking-tight text-primary">{titulo}</h1>
        {lista}
      </div>
    </main>
  );
}
