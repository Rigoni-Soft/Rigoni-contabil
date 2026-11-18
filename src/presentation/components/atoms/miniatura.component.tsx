import { cn } from "@/presentation/lib/utils";

// Imagem pequena e decorativa (a prévia do arquivo escolhido: o nome já está ao lado; a logo do avatar,
// onde o link que a envolve já tem nome acessível). `className` sobrescreve o tamanho e o arredondamento.
export function Miniatura({ src, className }: { src: string; className?: string }) {
  const classes = cn("size-12 shrink-0 rounded-md object-cover", className);
  // eslint-disable-next-line @next/next/no-img-element -- blob: ou logo estática, sem otimizador
  return <img src={src} alt="" className={classes} />;
}
