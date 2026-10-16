import { useState } from "react";

const CHAVE = "emojis-recentes";
const MAXIMO = 8;

// Conveniência por navegador (arquitetura: localStorage só para isso); sem storage, lista vazia.
function ler(): string[] {
  try {
    const lista: unknown = JSON.parse(localStorage.getItem(CHAVE) ?? "[]");
    if (!Array.isArray(lista)) return [];
    // O storage é editável: só strings, sem repetidas (viram `key` do botão) e no máximo MAXIMO.
    const textos = lista.filter((e): e is string => typeof e === "string");
    return [...new Set(textos)].slice(0, MAXIMO);
  } catch {
    // Storage indisponível ou JSON inválido: sem recentes.
    return [];
  }
}

// Últimos emojis escolhidos, do mais novo ao mais antigo, compartilhados pelo campo de resposta e
// pela reação. `recarregar` ao abrir o seletor: o outro seletor pode ter escolhido depois.
export function useEmojisRecentes() {
  // Só aparece com o painel aberto (depois da hidratação), então ler o storage aqui não diverge do SSR.
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
