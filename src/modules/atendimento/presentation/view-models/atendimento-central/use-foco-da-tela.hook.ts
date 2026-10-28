import { useEffect, useRef } from "react";

// Foco da tela Atendimento. O card clicado some da lista (assumir) ou a lista some da tela (celular),
// e sem destino o foco cairia no <body>: quem usa teclado ou leitor de tela perderia o lugar.

// Abriu uma conversa (ou trocou de conversa): o foco vai para o chat, quando ele já está na tela.
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

// Fechou a conversa (voltar, encerrar, transferir): o foco volta para a lista. Ao montar não há o
// que devolver.
export function useFocoNaLista(abertoId: string | null) {
  const ref = useRef<HTMLElement>(null);
  const anterior = useRef(abertoId);

  useEffect(() => {
    if (anterior.current !== null && abertoId === null) ref.current?.focus();
    anterior.current = abertoId;
  }, [abertoId]);

  return ref;
}
