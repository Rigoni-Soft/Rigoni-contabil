import { useEffect, type RefObject } from "react";

export function useFechaSeletor(
  aberto: boolean,
  raiz: RefObject<HTMLElement | null>,
  botao: RefObject<HTMLElement | null>,
  fechar: () => void,
) {
  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key !== "Escape") return;
      fechar();
      botao.current?.focus();
    };
    const aoClicar = (evento: PointerEvent) => {
      if (!raiz.current?.contains(evento.target as Node)) fechar();
    };
    const aoRolar = (evento: Event) => {
      if (!raiz.current?.contains(evento.target as Node)) fechar();
    };
    document.addEventListener("scroll", aoRolar, true);
    document.addEventListener("keydown", aoTeclar);
    document.addEventListener("pointerdown", aoClicar);
    return () => {
      document.removeEventListener("scroll", aoRolar, true);
      document.removeEventListener("keydown", aoTeclar);
      document.removeEventListener("pointerdown", aoClicar);
    };
  }, [aberto, raiz, botao, fechar]);
}
