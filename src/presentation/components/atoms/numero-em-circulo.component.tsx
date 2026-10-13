type NumeroEmCirculoProps = {
  valor: number;
  // Texto lido por leitor de tela antes do número (o número sozinho não diz do que é).
  prefixo: string;
};

export function NumeroEmCirculo({ valor, prefixo }: NumeroEmCirculoProps) {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
      <span className="sr-only">{prefixo} </span>
      {valor}
    </span>
  );
}
