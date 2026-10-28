import { useEffect, useRef, useState } from "react";

// O som avisa quem ouve; este texto avisa o leitor de tela (WCAG 4.1.3) quando o contador do menu
// cresce. A primeira leitura é silenciosa e só o que cresce é novidade. Na tela Atendimento (`ativo`
// falso) a própria tela anuncia, mas a base segue sendo guardada para não anunciar ao sair dela.
export function useAnuncioDoMenu(total: number, pronto: boolean, ativo: boolean) {
  const [anuncio, setAnuncio] = useState("");
  const anterior = useRef<number | null>(null);

  useEffect(() => {
    if (!pronto) return;
    const antes = anterior.current;
    anterior.current = total;
    if (!ativo || antes === null) return;
    // Diminuir limpa o aviso: o mesmo total, mais adiante, volta a ser lido.
    setAnuncio(
      total > antes ? `Atendimento: ${total} ${total === 1 ? "pendente" : "pendentes"}.` : "",
    );
  }, [total, pronto, ativo]);

  return anuncio;
}
