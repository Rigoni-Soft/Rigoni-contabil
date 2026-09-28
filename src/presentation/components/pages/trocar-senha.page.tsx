type TrocarSenhaPageProps = {
  header: React.ReactNode;
  formulario: React.ReactNode;
  obrigatoria: boolean;
};

export function TrocarSenhaPage({ header, formulario, obrigatoria }: TrocarSenhaPageProps) {
  return (
    <main className="min-h-screen bg-background">
      {header}
      <div className="mx-auto max-w-md px-4 py-8 sm:px-6">
        <h1 className="mb-2 text-xl font-bold tracking-tight text-primary">Trocar senha</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          {obrigatoria
            ? "Você está usando uma senha provisória. Defina uma nova senha para continuar."
            : "Defina uma nova senha para sua conta."}
        </p>
        {formulario}
      </div>
    </main>
  );
}
