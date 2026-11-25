import { useEffect, useRef, useState } from "react";

export function useAnuncioDoMenu(total: number, pronto: boolean, ativo: boolean) {
  const [anuncio, setAnuncio] = useState("");
  const anterior = useRef<number | null>(null);

  useEffect(() => {
    if (!pronto) return;
    const antes = anterior.current;
    anterior.current = total;
    if (!ativo || antes === null) return;
    setAnuncio(
      total > antes ? `Atendimento: ${total} ${total === 1 ? "pendente" : "pendentes"}.` : "",
    );
  }, [total, pronto, ativo]);

  return anuncio;
}
