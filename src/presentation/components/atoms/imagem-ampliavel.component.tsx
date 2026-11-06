import { Download, X } from "lucide-react";

import { Button, buttonVariants } from "@/presentation/components/ui/button";
import { SUPERFICIE_DE_PAINEL } from "@/presentation/lib/superficie-de-painel";
import { cn } from "@/presentation/lib/utils";

type ImagemAmpliavelProps = {
  // A miniatura (ou o original, se não houver) e o original que o painel mostra.
  src: string;
  ampliadaSrc: string;
  // Endereço que baixa o original (Content-Disposition de anexo).
  baixarHref: string;
  // Nome acessível da miniatura e da imagem ampliada.
  alt: string;
  // Liga o botão ao painel; único na página (a View não gera id).
  painelId: string;
};

// Miniatura que abre a imagem ampliada num popover nativo: fecha com Esc, clicando fora ou pelo
// botão (o primeiro Tab depois de abrir), sem estado nem script. A caixa da miniatura tem tamanho
// fixo: a imagem que termina de carregar não desloca a conversa (rolar fecharia o seletor de
// reação aberto).
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
        {/* Ações numa faixa própria: sobre a foto cobririam justamente o que se quer ver. */}
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
            // O React trata `autoFocus` focando na montagem (o painel ainda está oculto); o atributo
            // nativo é o que o popover usa para decidir o foco ao abrir.
            ref={(botao) => botao?.setAttribute("autofocus", "")}
            className="rounded-full"
          >
            <X className="size-5" aria-hidden="true" />
          </Button>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- idem */}
        <img
          src={ampliadaSrc}
          // O diálogo já se chama "Imagem ampliada: nome": repetir o nome faria o leitor de tela
          // lê-lo duas vezes.
          alt=""
          loading="lazy"
          decoding="async"
          className="max-h-[calc(90dvh-5rem)] max-w-full min-w-[min(80vw,16rem)] object-contain"
        />
      </div>
    </>
  );
}
