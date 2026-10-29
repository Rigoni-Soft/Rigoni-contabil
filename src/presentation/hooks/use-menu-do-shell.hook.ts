import { useEffect, useState } from "react";

// O menu do celular é um popover nativo: o navegador abre, fecha (Esc, clique fora) e devolve o foco.
// Este hook só espelha o estado em `aria-expanded`, escutando o evento `toggle` do painel.
export function useMenuDoShell(alvoId: string) {
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    const alvo = document.getElementById(alvoId);
    if (!alvo) return;
    const aoAlternar = (evento: Event) =>
      setAberto((evento as Event & { newState?: string }).newState === "open");
    alvo.addEventListener("toggle", aoAlternar);
    return () => alvo.removeEventListener("toggle", aoAlternar);
  }, [alvoId]);

  return aberto;
}
