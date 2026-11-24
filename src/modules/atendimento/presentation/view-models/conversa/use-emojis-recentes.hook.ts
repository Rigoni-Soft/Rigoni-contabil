import { useState } from "react";

const CHAVE = "emojis-recentes";
const MAXIMO = 8;

function ler(): string[] {
  try {
    const lista: unknown = JSON.parse(localStorage.getItem(CHAVE) ?? "[]");
    if (!Array.isArray(lista)) return [];
    const textos = lista.filter((e): e is string => typeof e === "string");
    return [...new Set(textos)].slice(0, MAXIMO);
  } catch {
    return [];
  }
}

export function useEmojisRecentes() {
  const [recentes, setRecentes] = useState<string[]>(ler);

  return {
    recentes,
    recarregar: () => setRecentes(ler()),
    registrar: (emoji: string) => {
      const novos = [emoji, ...ler().filter((e) => e !== emoji)].slice(0, MAXIMO);
      setRecentes(novos);
      try {
        localStorage.setItem(CHAVE, JSON.stringify(novos));
      } catch {}
    },
  };
}
