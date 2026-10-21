"use client";

import { useDocumentosContratuais } from "./documentos-contratuais.queries";
import { VisualizarDocumentoContratualContainer } from "./visualizar-documento-contratual.container";

// Sem acesso, carregando ou com erro: nada na tela (o botão é um acréscimo, nunca bloqueia o form).
export function DocumentoContratualDoClienteContainer({ clienteId }: { clienteId: string }) {
  const { data } = useDocumentosContratuais(clienteId);
  if (!data || data.length === 0) return null;
  return <VisualizarDocumentoContratualContainer clienteId={clienteId} documentos={data} />;
}
