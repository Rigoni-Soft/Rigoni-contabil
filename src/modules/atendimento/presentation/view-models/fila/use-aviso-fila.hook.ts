import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import { prepararSom, tocarNotificacao } from "@/presentation/lib/notificacao-sonora";
import { avisoDaFila } from "@/modules/atendimento/presentation/view-models/fila/fila.presenter";
import { useFilaQuery } from "@/modules/atendimento/presentation/view-models/fila/fila.queries";
import { ROTA_ATENDIMENTO } from "@/shared/kernel/rotas";

// Sem sessão não há Fila para consultar.
const SEM_FILA = ["/login", "/trocar-senha"];
// Na tela da Fila e na aba Atendimento ela já está à vista: sem cartão.
const TELA_DA_FILA = "/fila";
// Na conversa a Fila fica na barra lateral, que só existe em tela larga (xl): em tela estreita o
// cartão continua sendo o caminho até ela.
const CONVERSA = "/atendimento/";

// Aviso global da Fila do Setor do usuário: som quando alguém entra, em qualquer tela menos a
// Atendimento (o som é dela); cartão no
// dock quando a Fila não está à vista (na conversa, só em tela estreita). Admin não tem Setor próprio: a leitura falha e o aviso some.
export function useAvisoFila() {
  const pathname = usePathname();
  const habilitado = !SEM_FILA.some((rota) => pathname.startsWith(rota));
  const query = useFilaQuery(null, undefined, habilitado);
  // Atendimentos da última leitura; null = ainda não houve leitura (a primeira é silenciosa).
  const anterior = useRef<Set<string> | null>(null);

  useEffect(() => prepararSom(), []);

  useEffect(() => {
    if (!habilitado) {
      anterior.current = null;
      return;
    }
    if (!query.data) return;
    const atuais = new Set(query.data.map((item) => item.atendimentoId));
    const antes = anterior.current;
    // Na tela Atendimento o som é da própria tela (useSomDaLista): aqui tocaria em dobro.
    if (antes && pathname !== ROTA_ATENDIMENTO && [...atuais].some((id) => !antes.has(id))) {
      tocarNotificacao();
    }
    anterior.current = atuais;
  }, [query.data, habilitado, pathname]);

  const aviso = habilitado && query.data ? avisoDaFila(query.data) : null;
  if (!aviso || pathname.startsWith(TELA_DA_FILA) || pathname === ROTA_ATENDIMENTO) {
    return { aviso: null };
  }
  return { aviso: { ...aviso, soEmTelaEstreita: pathname.startsWith(CONVERSA) } };
}
