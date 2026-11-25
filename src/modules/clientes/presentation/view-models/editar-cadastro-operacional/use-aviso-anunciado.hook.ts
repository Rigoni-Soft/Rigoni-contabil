import { useState } from "react";

export function useAvisoAnunciado() {
  const [anuncio, setAnuncio] = useState({ texto: "", vez: 0 });
  const anunciar = (texto: string) => setAnuncio((atual) => ({ texto, vez: atual.vez + 1 }));
  return { aviso: anuncio.texto, avisoVez: anuncio.vez, anunciar };
}
