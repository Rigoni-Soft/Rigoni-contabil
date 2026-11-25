import { useEffect, useRef } from "react";

export function useFocoNoChat(abertoId: string | null, pronto: boolean) {
  const ref = useRef<HTMLElement>(null);
  const focada = useRef<string | null>(null);

  useEffect(() => {
    if (abertoId === null) {
      focada.current = null;
      return;
    }
    if (!pronto || focada.current === abertoId) return;
    focada.current = abertoId;
    ref.current?.focus();
  }, [abertoId, pronto]);

  return ref;
}

export function useFocoNaLista(abertoId: string | null) {
  const ref = useRef<HTMLElement>(null);
  const anterior = useRef(abertoId);

  useEffect(() => {
    if (anterior.current !== null && abertoId === null) ref.current?.focus();
    anterior.current = abertoId;
  }, [abertoId]);

  return ref;
}
