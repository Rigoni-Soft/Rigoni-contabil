import { useQuery } from "@tanstack/react-query";

import type { DocumentoContratualVisivelDto } from "@/modules/clientes/application/ports/in/documentos-contratuais-cliente.provider";

import { listarDocumentosContratuaisAction } from "./visualizar-documento-contratual.actions";

// `iniciais` vem do loader do servidor (tela própria); sem ele (cliente aberto na busca, já no
// navegador) a lista é lida por Server Action.
export function useDocumentosContratuais(
  clienteId: string,
  iniciais?: DocumentoContratualVisivelDto[],
) {
  return useQuery<DocumentoContratualVisivelDto[]>({
    queryKey: ["clientes", "documentos-contratuais", clienteId],
    queryFn: async () => {
      const resultado = await listarDocumentosContratuaisAction(clienteId);
      if (!resultado.ok) throw new Error(resultado.error.message);
      return resultado.data;
    },
    initialData: iniciais,
    staleTime: 60_000,
  });
}
