type CabecalhoDaConversaProps = { titulo: string; subtitulo: string; encerrado: boolean };

export function CabecalhoDaConversa({ titulo, subtitulo, encerrado }: CabecalhoDaConversaProps) {
  return (
    <header className="shrink-0">
      <h1 className="text-lg font-bold tracking-tight text-primary">{titulo}</h1>
      <p className="text-sm text-muted-foreground">{subtitulo}</p>
      {encerrado && (
        <p className="mt-1 text-sm font-medium text-muted-foreground">Atendimento encerrado.</p>
      )}
    </header>
  );
}
