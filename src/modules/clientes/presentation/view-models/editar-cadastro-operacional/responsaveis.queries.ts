import { useQuery } from "@tanstack/react-query";

import type { ResponsavelOpcaoDto } from "@/modules/clientes/application/ports/out/cliente-query.provider";
import { listarResponsaveisElegiveisAction } from "@/modules/clientes/presentation/view-models/editar-cadastro-operacional/atribuir-responsavel.actions";

const RESPONSAVEIS_FRESCOS_POR_MS = 60_000;

export function useResponsaveisElegiveis(enabled: boolean) {
  return useQuery<ResponsavelOpcaoDto[]>({
    queryKey: ["clientes", "responsaveis-elegiveis"],
    queryFn: async () => {
      const resultado = await listarResponsaveisElegiveisAction();
      if (!resultado.ok) throw new Error(resultado.error.message);
      return resultado.data;
    },
    enabled,
    staleTime: RESPONSAVEIS_FRESCOS_POR_MS,
  });
}
