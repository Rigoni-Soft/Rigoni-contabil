import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import type { DocumentoContratualVisivelDto } from "@/modules/clientes/application/ports/in/documentos-contratuais-cliente.provider";

import { listarDocumentosContratuaisAction } from "./visualizar-documento-contratual.actions";

export const chaveDocumentosContratuais = (clienteId: string) =>
  ["clientes", "documentos-contratuais", clienteId] as const;

// `iniciais` vem do loader do servidor (tela própria); sem ele (cliente aberto na busca, já no
// navegador) a lista é lida por Server Action. `alteracaoEmFoco` (nº do aviso): com a lista em cache
// ainda "fresca" a carga nova do servidor não a substitui, então a alteração pedida pode faltar só
// no cache. Nesse caso a lista é relida uma vez por Cliente+nº antes de concluir que ela não existe;
// `confirmando` segura a tela até lá, para não oferecer o link de outro documento.
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
    staleTime: 60_000,
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
