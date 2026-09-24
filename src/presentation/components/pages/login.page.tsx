type LoginPageProps = { formulario: React.ReactNode };

export function LoginPage({ formulario }: LoginPageProps) {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <h1 className="text-xl font-semibold">Entrar — Rigoni Contábil</h1>
        {formulario}
      </div>
    </main>
  );
}
