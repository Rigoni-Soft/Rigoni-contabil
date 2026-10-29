import { useEffect, useState } from "react";

// O menu do celular é um popover nativo: o navegador abre, fecha (Esc, clique fora) e devolve o foco.
// Este hook só espelha o estado em `aria-expanded`, escutando o evento `toggle` do painel, e cobre o
// navegador sem popover (Safari < 17, Firefox < 125): lá o botão alterna `data-aberto` no painel, e
// Esc ou um clique fora o fecham.
const suportaPopover = () =>
  typeof HTMLElement !== "undefined" && "popover" in HTMLElement.prototype;

export function useMenuDoShell(alvoId: string) {
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    const alvo = document.getElementById(alvoId);
    if (!alvo) return;
    if (suportaPopover()) {
      const aoAlternar = (evento: Event) =>
        setAberto((evento as Event & { newState?: string }).newState === "open");
      alvo.addEventListener("toggle", aoAlternar);
      return () => alvo.removeEventListener("toggle", aoAlternar);
    }
    // ponytail: fallback mínimo (alternar, Esc, clique fora); sem armadilha de foco nem anel de retorno.
    alvo.dataset.aberto = String(aberto);
    if (!aberto) return;
    const fechar = () => setAberto(false);
    const aoTeclar = (evento: KeyboardEvent) => evento.key === "Escape" && fechar();
    const aoClicar = (evento: Event) => {
      if (
        !alvo.contains(evento.target as Node) &&
        !(evento.target as Element).closest?.("[data-botao-do-menu]")
      )
        fechar();
    };
    document.addEventListener("keydown", aoTeclar);
    document.addEventListener("pointerdown", aoClicar);
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.removeEventListener("pointerdown", aoClicar);
    };
  }, [alvoId, aberto]);

  // Com popover nativo o clique já alterna pelo `popovertarget`; só o fallback alterna aqui.
  const aoClicar = () => {
    if (!suportaPopover()) setAberto((atual) => !atual);
  };

  return { aberto, aoClicar };
}
