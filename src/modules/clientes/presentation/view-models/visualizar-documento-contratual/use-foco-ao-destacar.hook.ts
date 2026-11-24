import { useEffect, useRef } from "react";

const TENTATIVAS_MAXIMAS = 120;

export function useFocoAoDestacar(destacar: boolean, destino: string) {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!destacar) return;
    const focoInicial = document.activeElement;
    let quadro = 0;
    let tentativas = 0;
    const tentar = () => {
      const botao = ref.current;
      if (!botao) return;
      if (document.activeElement !== focoInicial) return;
      botao.focus();
      if (document.activeElement === botao) return;
      if (++tentativas < TENTATIVAS_MAXIMAS) quadro = requestAnimationFrame(tentar);
    };
    tentar();
    return () => cancelAnimationFrame(quadro);
  }, [destacar, destino]);

  return ref;
}
