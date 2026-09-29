import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type EditarCadastroOperacionalPageProps = {
  header: React.ReactNode;
  titulo: string;
  formulario: React.ReactNode;
};

export function EditarCadastroOperacionalPage({
  header,
  titulo,
  formulario,
}: EditarCadastroOperacionalPageProps) {
  return (
    <main className="min-h-screen bg-background">
      {header}
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Voltar
        </Link>
        <h1 className="mt-3 mb-6 text-xl font-bold tracking-tight text-primary">{titulo}</h1>
        {formulario}
      </div>
    </main>
  );
}
