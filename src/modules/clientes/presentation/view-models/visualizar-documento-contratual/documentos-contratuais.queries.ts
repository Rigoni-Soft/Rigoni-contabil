import { useQuery } from "@tanstack/react-query";

import type { DocumentoContratualVisivelDto } from "@/modules/clientes/application/ports/in/documentos-contratuais-cliente.provider";

import { listarDocumentosContratuaisAction } from "./visualizar-documento-contratual.actions";

export function useDocumentosContratuais(clienteId: string) {
  return useQuery<DocumentoContratualVisivelDto[]>({
    queryKey: ["clientes", "documentos-contratuais", clienteId],
    queryFn: async () => {
      const resultado = await listarDocumentosContratuaisAction(clienteId);
      if (!resultado.ok) throw new Error(resultado.error.message);
      return resultado.data;
    },
    staleTime: 60_000,
  });
}
