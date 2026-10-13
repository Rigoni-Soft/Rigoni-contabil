import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type UsuariosListaPageProps = { header: React.ReactNode; lista: React.ReactNode };

export function UsuariosListaPage({ header, lista }: UsuariosListaPageProps) {
  return (
    <main className="min-h-dvh bg-background">
      {header}
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Voltar
        </Link>
        <h1 className="mt-3 mb-6 text-xl font-bold tracking-tight text-primary">Usuários</h1>
        {lista}
      </div>
    </main>
  );
}
