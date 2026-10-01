import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type EditarCadastroOperacionalPageProps = {
  header: React.ReactNode;
  titulo: string;
  formulario: React.ReactNode;
  // De onde a tela foi aberta (ex.: a lista de um bucket do resumo do
  // setor, #36) — "Voltar" leva pra lá, não sempre pro dashboard.
  voltarHref?: string;
};

export function EditarCadastroOperacionalPage({
  header,
  titulo,
  formulario,
  voltarHref = "/",
}: EditarCadastroOperacionalPageProps) {
  return (
    <main className="min-h-screen bg-background">
      {header}
      <div className="mx-auto w-[90%] px-4 py-8 sm:px-6">
        <Link
          href={voltarHref}
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
