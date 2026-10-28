import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import { prepararSom, tocarNotificacao } from "@/presentation/lib/notificacao-sonora";
import { atendimentoParaView } from "@/modules/atendimento/presentation/view-models/meus-atendimentos/meus-atendimentos.presenter";
import { useMeusAtendimentosQuery } from "@/modules/atendimento/presentation/view-models/meus-atendimentos/meus-atendimentos.queries";
import { ROTA_ATENDIMENTO } from "@/shared/kernel/rotas";

// Sem sessão (login, troca de senha obrigatória) não há o que consultar; na própria conversa o
// Atendimento já está na tela e a conversa faz a sua leitura (uma leitura reativa por tela,
// arquitetura.md 4.9).
const SEM_ATENDIMENTOS = ["/login", "/trocar-senha", "/atendimento/"];
// Na tela Atendimento a lista já está à vista (aba "Em atendimento"): o aviso sonoro segue, o cartão
// do dock não (cobriria o painel de ações).

export function useMeusAtendimentos() {
  const pathname = usePathname();
  const habilitado = !SEM_ATENDIMENTOS.some((rota) => pathname.startsWith(rota));
  const query = useMeusAtendimentosQuery(habilitado);
  // Atendimento -> sinal da última leitura. null = ainda não houve leitura (a primeira é silenciosa:
  // o que já estava lá ao abrir a tela não é novidade).
  const anterior = useRef<Map<string, string> | null>(null);

  useEffect(() => prepararSom(), []);

  useEffect(() => {
    if (!habilitado) {
      anterior.current = null;
      return;
    }
    if (!query.data) return;
    const atuais = query.data.map(atendimentoParaView);
    const antes = anterior.current;
    // Toca quando surge um Atendimento ou quando o cliente escreveu de novo (o sinal mudou e a
    // última mensagem é dele); resposta nossa ou da URA não toca.
    const novidade = atuais.some(
      (a) => antes !== null && (!antes.has(a.id) || (a.aguardando && antes.get(a.id) !== a.sinal)),
    );
    if (novidade) tocarNotificacao();
    anterior.current = new Map(atuais.map((a) => [a.id, a.sinal]));
  }, [query.data, habilitado]);

  const aVista = habilitado && pathname !== ROTA_ATENDIMENTO;
  return { atendimentos: aVista ? (query.data ?? []).map(atendimentoParaView) : [] };
}
