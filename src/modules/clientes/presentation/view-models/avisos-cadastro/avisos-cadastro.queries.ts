import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import type { CursorAvisoCadastro } from "@/modules/clientes/application/dtos/aviso-cadastro.dto";
import {
  contarAvisosNaoVistosAction,
  listarAvisosCadastroAction,
} from "@/modules/clientes/presentation/view-models/avisos-cadastro/avisos-cadastro.actions";

export const avisosCadastroKeys = {
  todos: (usuarioId: string) => ["clientes", "avisos-cadastro", usuarioId] as const,
};

const INTERVALO_DO_POLLING_DE_AVISOS_EM_MS = 30_000;

export function useContadorAvisosQuery(usuarioId: string) {
  return useQuery({
    queryKey: [...avisosCadastroKeys.todos(usuarioId), "contador"],
    queryFn: async () => {
      const resultado = await contarAvisosNaoVistosAction();
      if (!resultado.ok) throw new Error(resultado.error.message);
      return resultado.data;
    },
    refetchInterval: INTERVALO_DO_POLLING_DE_AVISOS_EM_MS,
    staleTime: INTERVALO_DO_POLLING_DE_AVISOS_EM_MS,
    retry: false,
  });
}

export function useListaAvisosQuery(usuarioId: string, habilitado: boolean) {
  return useInfiniteQuery({
    queryKey: [...avisosCadastroKeys.todos(usuarioId), "lista"],
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
