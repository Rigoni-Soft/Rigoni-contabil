type EntradaTemplateProps = {
  titulo: string;
  subtitulo: string;
  rodape: string;
  formulario: React.ReactNode;
};

// Tela de entrada (login): conteúdo único centralizado, sem cabeçalho nem navegação. Sempre Server.
export function EntradaTemplate({ titulo, subtitulo, rodape, formulario }: EntradaTemplateProps) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-12 sm:px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-primary">{titulo}</h1>
          <p className="text-sm text-muted-foreground">{subtitulo}</p>
        </div>

        <div className="rc-guilloche-frame rounded-lg border border-border bg-card p-6 shadow-sm sm:p-8">
          {formulario}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">{rodape}</p>
      </div>
    </main>
  );
}
