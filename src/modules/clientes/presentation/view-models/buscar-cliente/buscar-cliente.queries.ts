import { useQuery } from "@tanstack/react-query";

import type { SugestaoClienteDto } from "@/modules/clientes/application/ports/out/cliente-query.provider";
import { buscarClientesAction } from "@/modules/clientes/presentation/view-models/buscar-cliente/buscar-cliente.actions";
import { TAMANHO_MINIMO_TERMO } from "@/modules/clientes/presentation/view-models/buscar-cliente/buscar-cliente.schema";

export const buscarClientesKeys = {
  lista: (termo: string, apenasSnMei: boolean) =>
    ["clientes", "buscar", termo, apenasSnMei] as const,
};

export function useBuscarClientes(termo: string, apenasSnMei: boolean) {
  return useQuery<SugestaoClienteDto[]>({
    queryKey: buscarClientesKeys.lista(termo, apenasSnMei),
    queryFn: async () => {
      const resultado = await buscarClientesAction({ termo, apenasSnMei });
      if (!resultado.ok) throw new Error(resultado.error.message);
      return resultado.data;
    },
    enabled: termo.length >= TAMANHO_MINIMO_TERMO,
    staleTime: 30_000,
  });
}
