import { usePathname } from "next/navigation";

import { useSomDaLista } from "@/modules/atendimento/presentation/view-models/atendimento-central/use-som-da-lista.hook";
import { useFilaQuery } from "@/modules/atendimento/presentation/view-models/fila/fila.queries";
import { atendimentoParaView } from "@/modules/atendimento/presentation/view-models/meus-atendimentos/meus-atendimentos.presenter";
import { useMeusAtendimentosQuery } from "@/modules/atendimento/presentation/view-models/meus-atendimentos/meus-atendimentos.queries";
import { ROTA_ATENDIMENTO } from "@/shared/kernel/rotas";

// Sem sessão (login, troca de senha obrigatória) não há o que consultar.
const SEM_SESSAO = ["/login", "/trocar-senha"];

// O polling de 15 s e o aviso sonoro em toda tela autenticada, sem interface própria. Nenhuma
// conversa fica de fora do aviso (`null`): quem a tem aberta está na tela Atendimento, onde o som é
// dela e este hook fica mudo. O contador do menu e a tela Atendimento só leem o mesmo cache. Admin
// não tem Setor próprio: a leitura da espera é negada e só as conversas contam.
export function useAvisoGlobal() {
  const pathname = usePathname();
  const habilitado = !SEM_SESSAO.some((rota) => pathname.startsWith(rota));
  const fila = useFilaQuery(null, undefined, habilitado);
  const meus = useMeusAtendimentosQuery(habilitado);

  useSomDaLista(
    (fila.data ?? []).map((item) => item.atendimentoId),
    (meus.data ?? []).map(atendimentoParaView),
    null,
    habilitado && pathname !== ROTA_ATENDIMENTO,
  );
}
