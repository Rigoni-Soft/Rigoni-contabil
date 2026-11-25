import { usePathname } from "next/navigation";

import { useSomDaLista } from "@/modules/atendimento/presentation/view-models/atendimento-central/use-som-da-lista.hook";
import { useFilaQuery } from "@/modules/atendimento/presentation/view-models/fila/fila.queries";
import { atendimentoParaView } from "@/modules/atendimento/presentation/view-models/meus-atendimentos/meus-atendimentos.presenter";
import { useMeusAtendimentosQuery } from "@/modules/atendimento/presentation/view-models/meus-atendimentos/meus-atendimentos.queries";
import { ROTA_ATENDIMENTO } from "@/shared/kernel/rotas";

const SEM_SESSAO = ["/login", "/trocar-senha"];

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
