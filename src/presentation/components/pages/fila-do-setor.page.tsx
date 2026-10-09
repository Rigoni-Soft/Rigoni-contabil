import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type FilaDoSetorPageProps = {
  header: React.ReactNode;
  fila: React.ReactNode;
};

export function FilaDoSetorPage({ header, fila }: FilaDoSetorPageProps) {
  return (
    <main className="min-h-screen bg-background">
      {header}
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <Link
          href="/"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Voltar
        </Link>
        <h1 className="mb-6 text-xl font-bold tracking-tight text-primary">Fila de atendimento</h1>
        {fila}
      </div>
    </main>
  );
}
