import { usePathname } from "next/navigation";

import { atendimentoParaView } from "@/modules/atendimento/presentation/view-models/meus-atendimentos/meus-atendimentos.presenter";
import { useMeusAtendimentosQuery } from "@/modules/atendimento/presentation/view-models/meus-atendimentos/meus-atendimentos.queries";

// Sem sessão (login, troca de senha obrigatória) não há o que consultar; na própria conversa o
// Atendimento já está na tela e a conversa faz a sua leitura (uma leitura reativa por tela,
// arquitetura.md 4.9).
const SEM_ATENDIMENTOS = ["/login", "/trocar-senha", "/atendimento/"];

export function useMeusAtendimentos() {
  const pathname = usePathname();
  const habilitado = !SEM_ATENDIMENTOS.some((rota) => pathname.startsWith(rota));
  const query = useMeusAtendimentosQuery(habilitado);

  return { atendimentos: habilitado ? (query.data ?? []).map(atendimentoParaView) : [] };
}
