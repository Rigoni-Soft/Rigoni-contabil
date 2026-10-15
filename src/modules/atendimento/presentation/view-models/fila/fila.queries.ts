import { useQuery } from "@tanstack/react-query";

import type { ItemDaFilaVisto } from "@/modules/atendimento/application/ports/in/listar-fila.provider";
import { listarFilaAction } from "@/modules/atendimento/presentation/view-models/fila/fila.actions";
import type { SetorSlug } from "@/shared/kernel/setores";

export const filaKeys = {
  // Prefixo de toda leitura da Fila: invalida todas de uma vez.
  todas: () => ["atendimento", "fila"] as const,
  // `null` = a Fila do Setor do próprio usuário: a tela, a barra lateral da conversa e o aviso
  // global leem a mesma chave, então viram uma leitura só.
  setor: (setor: SetorSlug | null) => [...filaKeys.todas(), setor ?? "minha"] as const,
};

// ponytail: polling a cada 5 s; entrada, saída e promoção aparecem em até esse tempo. Realtime
// (`*.realtime.ts`, arquitetura.md 4.2) quando o atraso incomodar.
const INTERVALO_MS = 5_000;

export function useFilaQuery(
  setor: SetorSlug | null,
  initialData: ItemDaFilaVisto[] | undefined,
  habilitado = true,
) {
  return useQuery({
    queryKey: filaKeys.setor(setor),
    queryFn: async () => {
      const resultado = await listarFilaAction(setor ?? undefined);
      if (!resultado.ok) {
        throw new Error(resultado.error.message, { cause: resultado.error.code });
      }
      return resultado.data;
    },
    initialData,
    enabled: habilitado,
    // A Fila "minha" desiste só quando é negada (Admin não tem Setor; sessão expirada); erro
    // passageiro de rede segue tentando no próximo ciclo.
    refetchInterval: (query) =>
      setor === null && query.state.error?.cause === "FORBIDDEN" ? false : INTERVALO_MS,
    staleTime: INTERVALO_MS,
    retry: false,
  });
}
