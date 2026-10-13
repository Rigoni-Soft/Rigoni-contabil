import { X } from "lucide-react";

type ImagemAmpliavelProps = {
  // A miniatura (ou o original, se não houver) e o original que o painel mostra.
  src: string;
  ampliadaSrc: string;
  // Nome acessível da miniatura e da imagem ampliada.
  alt: string;
  // Liga o botão ao painel; único na página (a View não gera id).
  painelId: string;
};

// Miniatura que abre a imagem ampliada num popover nativo: fecha com Esc, clicando fora ou pelo
// botão (o primeiro Tab depois de abrir), sem estado nem script. A caixa da miniatura tem tamanho
// fixo: a imagem que termina de carregar não desloca a conversa (rolar fecharia o seletor de
// reação aberto).
export function ImagemAmpliavel({ src, ampliadaSrc, alt, painelId }: ImagemAmpliavelProps) {
  return (
    <>
      <button
        type="button"
        popoverTarget={painelId}
        aria-label={`Ampliar ${alt}`}
        className="block size-40 overflow-hidden rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- link temporário do Storage e blob: não passam pelo otimizador */}
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
        />
      </button>
      <div
        id={painelId}
        popover="auto"
        role="dialog"
        aria-label={`Imagem ampliada: ${alt}`}
        className="m-auto max-h-[90dvh] max-w-[min(90vw,64rem)] min-w-[min(90vw,16rem)] overflow-visible rounded-xl border border-border bg-background p-2 backdrop:bg-black/60"
      >
        <button
          type="button"
          popoverTarget={painelId}
          popoverTargetAction="hide"
          aria-label="Fechar imagem"
          className="absolute top-3 right-3 flex size-11 items-center justify-center rounded-full bg-background/90 text-foreground shadow outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element -- idem */}
        <img
          src={ampliadaSrc}
          alt={alt}
          loading="lazy"
          decoding="async"
          className="max-h-[85dvh] max-w-full min-w-[min(80vw,16rem)] object-contain"
        />
      </div>
    </>
  );
}
