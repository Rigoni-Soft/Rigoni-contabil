// Imagem pequena e decorativa (a prévia do arquivo escolhido: o nome já está ao lado).
export function Miniatura({ src }: { src: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- blob: do arquivo local, sem otimizador
  return <img src={src} alt="" className="size-12 shrink-0 rounded-md object-cover" />;
}
