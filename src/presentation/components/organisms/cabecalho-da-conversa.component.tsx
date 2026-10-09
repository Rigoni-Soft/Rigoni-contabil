type CabecalhoDaConversaProps = {
  titulo: string;
  subtitulo: string;
  encerrado: boolean;
  transferencia?: { origem: string; resumo: string } | null;
};

export function CabecalhoDaConversa({
  titulo,
  subtitulo,
  encerrado,
  transferencia,
}: CabecalhoDaConversaProps) {
  return (
    <header className="shrink-0">
      <h1 className="text-lg font-bold tracking-tight text-primary">{titulo}</h1>
      <p className="text-sm text-muted-foreground">{subtitulo}</p>
      {transferencia && (
        <p className="mt-1 text-sm text-muted-foreground">
          <span className="font-medium">{transferencia.origem}:</span> {transferencia.resumo}
        </p>
      )}
      {encerrado && (
        <p className="mt-1 text-sm font-medium text-muted-foreground">Atendimento encerrado.</p>
      )}
    </header>
  );
}
