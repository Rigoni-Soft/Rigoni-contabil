import { useCallback, useEffect, useRef, useState } from "react";

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
