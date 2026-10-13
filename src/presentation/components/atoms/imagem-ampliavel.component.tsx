type ImagemAmpliavelProps = {
  src: string;
  // Nome acessível da miniatura e da imagem ampliada.
  alt: string;
  // Liga o botão ao painel; único na página (a View não gera id).
  painelId: string;
};

// Miniatura que abre a imagem ampliada num popover nativo: fecha com Esc ou clicando fora, sem
// estado nem script. A caixa tem tamanho fixo: a imagem que termina de carregar não desloca a
// conversa (rolar fecharia o seletor de reação aberto).
export function ImagemAmpliavel({ src, alt, painelId }: ImagemAmpliavelProps) {
  return (
    <>
      <button
        type="button"
        popoverTarget={painelId}
        aria-label={`Ampliar ${alt}`}
        className="block size-40 overflow-hidden rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- link temporário do Storage e blob: não passam pelo otimizador */}
        <img src={src} alt={alt} loading="lazy" className="size-full object-cover" />
      </button>
      <div
        id={painelId}
        popover="auto"
        className="m-auto max-h-[90dvh] max-w-[min(90vw,64rem)] rounded-xl border border-border bg-background p-2 backdrop:bg-black/60"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- idem */}
        <img src={src} alt={alt} className="max-h-[85dvh] max-w-full object-contain" />
      </div>
    </>
  );
}
