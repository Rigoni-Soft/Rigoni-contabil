import { useCallback, useEffect, useRef, useState } from "react";

// Depois de a tela se atualizar, o foco vai a um alvo estável (o botão que sumiu não pode deixar o foco no
// <body>). O alvo novo só existe depois da renderização: o foco fica pendente até o elemento aparecer.
export function useFocoPendente() {
  const alvo = useRef<string | null>(null);
  const [, renderizar] = useState(0);
  useEffect(() => {
    const elemento = alvo.current ? document.getElementById(alvo.current) : null;
    if (!elemento) return;
    alvo.current = null;
    elemento.focus();
  });
  return useCallback((id: string) => {
    alvo.current = id;
    renderizar((vez) => vez + 1);
  }, []);
}
