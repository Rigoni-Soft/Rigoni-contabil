import Link from "next/link";

type CriarUsuarioPageProps = { header: React.ReactNode; formulario: React.ReactNode };

export function CriarUsuarioPage({ header, formulario }: CriarUsuarioPageProps) {
  return (
    <main className="min-h-screen bg-background">
      {header}
      <div className="mx-auto max-w-md px-4 py-8 sm:px-6">
        <Link href="/" className="text-sm text-muted-foreground hover:underline">
          ← Voltar
        </Link>
        <h1 className="mt-2 mb-6 text-xl font-bold tracking-tight text-primary">
          Cadastrar Líder ou Funcionário
        </h1>
        {formulario}
      </div>
    </main>
  );
}
