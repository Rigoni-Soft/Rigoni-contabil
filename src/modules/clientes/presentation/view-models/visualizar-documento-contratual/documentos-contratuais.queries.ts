import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import type { DocumentoContratualVisivelDto } from "@/modules/clientes/application/ports/in/documentos-contratuais-cliente.provider";

import { listarDocumentosContratuaisAction } from "./visualizar-documento-contratual.actions";

const DOCUMENTOS_FRESCOS_POR_MS = 60_000;

export const chaveDocumentosContratuais = (clienteId: string) =>
  ["clientes", "documentos-contratuais", clienteId] as const;

export function useDocumentosContratuais(
  clienteId: string,
  iniciais?: DocumentoContratualVisivelDto[],
  alteracaoEmFoco?: number,
) {
  const query = useQuery<DocumentoContratualVisivelDto[]>({
    queryKey: chaveDocumentosContratuais(clienteId),
    queryFn: async () => {
      const resultado = await listarDocumentosContratuaisAction(clienteId);
      if (!resultado.ok) throw new Error(resultado.error.message);
      return resultado.data;
    },
    initialData: iniciais,
    staleTime: DOCUMENTOS_FRESCOS_POR_MS,
  });

  const { data, refetch } = query;
  const ausente =
    alteracaoEmFoco !== undefined &&
    data !== undefined &&
    !data.some((d) => d.tipo === "alteracao" && d.numero === alteracaoEmFoco);
  const chave = `${clienteId}:${alteracaoEmFoco}`;
  const [conferida, setConferida] = useState<string>();
  useEffect(() => {
    if (!ausente || conferida === chave) return;
    let ativo = true;
    void refetch().finally(() => {
      if (ativo) setConferida(chave);
    });
    return () => {
      ativo = false;
    };
  }, [ausente, chave, conferida, refetch]);

  return { ...query, confirmando: ausente && conferida !== chave };
}
