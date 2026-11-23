import { useState } from "react";

// O texto que a região aria-live anuncia. A mesma ação repetida não muda o texto e o leitor de tela não a diria
// de novo: `vez` muda a cada anúncio, e a View o usa como `key` da região para que ela seja relida.
export function useAvisoAnunciado() {
  const [anuncio, setAnuncio] = useState({ texto: "", vez: 0 });
  const anunciar = (texto: string) => setAnuncio((atual) => ({ texto, vez: atual.vez + 1 }));
  return { aviso: anuncio.texto, avisoVez: anuncio.vez, anunciar };
}
