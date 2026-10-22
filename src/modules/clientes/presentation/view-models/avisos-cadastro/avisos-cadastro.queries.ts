import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import type { CursorAvisoCadastro } from "@/modules/clientes/application/dtos/aviso-cadastro.dto";
import {
  contarAvisosNaoVistosAction,
  listarAvisosCadastroAction,
} from "@/modules/clientes/presentation/view-models/avisos-cadastro/avisos-cadastro.actions";

export const avisosCadastroKeys = {
  // Prefixo de toda leitura de Avisos (contador e lista): invalida as duas de uma vez.
  todos: () => ["clientes", "avisos-cadastro"] as const,
};

// ponytail: polling a cada 30 s (mais a cada navegação, no hook); o aviso aparece em até esse
// tempo. Realtime (`*.realtime.ts`, arquitetura.md 4.2) quando o atraso incomodar.
const INTERVALO_MS = 30_000;

export function useContadorAvisosQuery() {
  return useQuery({
    queryKey: [...avisosCadastroKeys.todos(), "contador"],
    queryFn: async () => {
      const resultado = await contarAvisosNaoVistosAction();
      if (!resultado.ok) throw new Error(resultado.error.message);
      return resultado.data;
    },
    refetchInterval: INTERVALO_MS,
    staleTime: INTERVALO_MS,
    retry: false,
  });
}

// Só lê depois que o modal abre (`habilitado`): o sino consulta o contador, não a lista.
export function useListaAvisosQuery(habilitado: boolean) {
  return useInfiniteQuery({
    queryKey: [...avisosCadastroKeys.todos(), "lista"],
    queryFn: async ({ pageParam }) => {
      const resultado = await listarAvisosCadastroAction(pageParam);
      if (!resultado.ok) throw new Error(resultado.error.message);
      return resultado.data;
    },
    initialPageParam: null as CursorAvisoCadastro | null,
    getNextPageParam: (ultima) => ultima.proximoCursor,
    enabled: habilitado,
    retry: false,
  });
}
