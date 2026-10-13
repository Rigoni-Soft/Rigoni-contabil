type LoginPageProps = { formulario: React.ReactNode };

export function LoginPage({ formulario }: LoginPageProps) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-12 sm:px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-primary">Rigoni Contábil</h1>
          <p className="text-sm text-muted-foreground">Entrar no sistema interno</p>
        </div>

        <div className="rc-guilloche-frame rounded-lg border border-border bg-card p-6 shadow-sm sm:p-8">
          {formulario}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Acesso restrito — uso interno Rigoni Contábil.
        </p>
      </div>
    </main>
  );
}
