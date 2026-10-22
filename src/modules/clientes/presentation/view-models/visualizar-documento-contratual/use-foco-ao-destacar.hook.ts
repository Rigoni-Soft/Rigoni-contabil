import { useEffect, useRef } from "react";

// ~2 s a 60 fps; com CPU lenta os quadros demoram mais, e o teto cobre a hidratação mais arrastada.
const TENTATIVAS_MAXIMAS = 120;

// Foca o botão ao chegar por aviso. O formulário fica `visibility: hidden` até hidratar, e o
// `focus()` num elemento oculto não faz nada (o `autoFocus` do mount perdia essa corrida): tenta a
// cada quadro até pegar. Desiste se o usuário já foi para outro controle ou ao esgotar as tentativas.
export function useFocoAoDestacar(destacar: boolean) {
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
  }, [destacar]);

  return ref;
}
