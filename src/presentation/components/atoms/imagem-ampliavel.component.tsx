import { Download, X } from "lucide-react";

import { Button, buttonVariants } from "@/presentation/components/ui/button";
import { SUPERFICIE_DE_PAINEL } from "@/presentation/lib/superficie-de-painel";
import { cn } from "@/presentation/lib/utils";

type ImagemAmpliavelProps = {
  src: string;
  ampliadaSrc: string;
  baixarHref: string;
  alt: string;
  painelId: string;
};

export function ImagemAmpliavel({
  src,
  ampliadaSrc,
  baixarHref,
  alt,
  painelId,
}: ImagemAmpliavelProps) {
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
        className={cn(
          SUPERFICIE_DE_PAINEL,
          "max-h-[90dvh] max-w-[min(90vw,64rem)] min-w-[min(90vw,16rem)] overflow-visible p-2",
        )}
      >
        <div className="mb-2 flex items-center justify-end gap-2">
          <a
            href={baixarHref}
            download={alt}
            aria-label={`Baixar ${alt}`}
            className={cn(buttonVariants({ variant: "ghost" }), "rounded-full")}
          >
            <Download aria-hidden="true" />
            Baixar
          </a>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            popoverTarget={painelId}
            popoverTargetAction="hide"
            aria-label="Fechar imagem"
            ref={(botao) => botao?.setAttribute("autofocus", "")}
            className="rounded-full"
          >
            <X className="size-5" aria-hidden="true" />
          </Button>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- idem */}
        <img
          src={ampliadaSrc}
          alt=""
          loading="lazy"
          decoding="async"
          className="max-h-[calc(90dvh-5rem)] max-w-full min-w-[min(80vw,16rem)] object-contain"
        />
      </div>
    </>
  );
}
