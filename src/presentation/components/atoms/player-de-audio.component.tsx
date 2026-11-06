// Player nativo: reproduzir/pausar, barra de progresso e duração, com teclado e leitor de tela.
export function PlayerDeAudio({ src, nome }: { src: string; nome: string }) {
  return (
    <audio
      controls
      preload="metadata"
      src={src}
      aria-label={`Áudio: ${nome}`}
      className="h-11 w-full min-w-48"
    />
  );
}
