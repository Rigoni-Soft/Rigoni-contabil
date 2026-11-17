// Imagem decorativa que preenche o círculo do avatar (o link que a envolve já tem nome acessível).
export function LogoRedonda({ src }: { src: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- logo estática de 256×256: sem otimizador nem config nova
  return <img src={src} alt="" className="size-full object-cover" />;
}
