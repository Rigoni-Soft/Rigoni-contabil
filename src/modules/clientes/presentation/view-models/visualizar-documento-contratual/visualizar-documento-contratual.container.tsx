"use client";

import { VisualizarDocumentoContratual } from "@/presentation/components/organisms/visualizar-documento-contratual.component";
import type { DocumentoContratualVisivelDto } from "@/modules/clientes/application/ports/in/documentos-contratuais-cliente.provider";

import { rotuloDoDocumento } from "./documentos-contratuais.presenter";
import { useVisualizarDocumentoContratual } from "./use-visualizar-documento-contratual.hook";

// `documentos` não pode ser vazio: quem renderiza decide pela lista (sem acesso = sem cartão).
type VisualizarDocumentoContratualContainerProps = {
  clienteId: string;
  documentos: DocumentoContratualVisivelDto[];
};

export function VisualizarDocumentoContratualContainer({
  clienteId,
  documentos,
}: VisualizarDocumentoContratualContainerProps) {
  const { documento, abrir, abrindo, erro, linkAlternativo } = useVisualizarDocumentoContratual(
    clienteId,
    documentos,
  );

  return (
    <VisualizarDocumentoContratual
      rotulo={rotuloDoDocumento(documento)}
      onAbrir={() => void abrir()}
      abrindo={abrindo}
      erro={erro}
      linkAlternativo={linkAlternativo}
    />
  );
}
