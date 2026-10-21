"use client";

import { VisualizarDocumentoContratual } from "@/presentation/components/organisms/visualizar-documento-contratual.component";
import type { DocumentoContratualVisivelDto } from "@/modules/clientes/application/ports/in/documentos-contratuais-cliente.provider";

import { paraOpcao, rotuloDoBotao } from "./documentos-contratuais.presenter";
import { useVisualizarDocumentoContratual } from "./use-visualizar-documento-contratual.hook";

// `documentos` não pode ser vazio: quem renderiza decide pela lista (sem acesso = sem botão).
type VisualizarDocumentoContratualContainerProps = {
  clienteId: string;
  documentos: DocumentoContratualVisivelDto[];
};

export function VisualizarDocumentoContratualContainer({
  clienteId,
  documentos,
}: VisualizarDocumentoContratualContainerProps) {
  const { selecionado, selecionar, abrir, abrindo, erro, linkAlternativo } =
    useVisualizarDocumentoContratual(clienteId, documentos);

  return (
    <VisualizarDocumentoContratual
      painelId={`documentos-contratuais-${clienteId}`}
      rotuloDoBotao={rotuloDoBotao(documentos)}
      opcoes={documentos.map(paraOpcao)}
      selecionado={paraOpcao(selecionado)}
      onSelecionar={selecionar}
      onAbrir={() => void abrir()}
      abrindo={abrindo}
      erro={erro}
      linkAlternativo={linkAlternativo}
    />
  );
}
