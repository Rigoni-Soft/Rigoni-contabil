import { useQuery } from "@tanstack/react-query";

import type { ResponsavelOpcaoDto } from "@/modules/clientes/application/ports/out/cliente-query.provider";
import { listarResponsaveisElegiveisAction } from "@/modules/clientes/presentation/view-models/editar-cadastro-operacional/atribuir-responsavel.actions";

// `enabled` só vira true quando o Líder abre o Select de Responsável —
// quem só visualiza ou edita sem trocar o Responsável nunca paga essa consulta.
export function useResponsaveisElegiveis(enabled: boolean) {
  return useQuery<ResponsavelOpcaoDto[]>({
    queryKey: ["clientes", "responsaveis-elegiveis"],
    queryFn: async () => {
      const resultado = await listarResponsaveisElegiveisAction();
      if (!resultado.ok) throw new Error(resultado.error.message);
      return resultado.data;
    },
    enabled,
    staleTime: 60_000,
  });
}
