"use client";

import { VisualizarDocumentoContratual } from "@/presentation/components/organisms/visualizar-documento-contratual.component";
import type { DocumentoContratualVisivelDto } from "@/modules/clientes/application/ports/in/documentos-contratuais-cliente.provider";

import {
  chaveDoDocumento,
  rotuloDoBotao,
  rotuloDoDocumento,
} from "./documentos-contratuais.presenter";
import { useVisualizarDocumentoContratual } from "./use-visualizar-documento-contratual.hook";

// `documentos` não pode ser vazio: quem renderiza decide pela lista (sem acesso = sem botão).
type Props = { clienteId: string; documentos: DocumentoContratualVisivelDto[] };

export function VisualizarDocumentoContratualContainer({ clienteId, documentos }: Props) {
  const { selecionado, selecionar, abrir, abrindo, erro, linkAlternativo } =
    useVisualizarDocumentoContratual(clienteId, documentos);

  return (
    <VisualizarDocumentoContratual
      painelId={`documentos-contratuais-${clienteId}`}
      rotuloDoBotao={rotuloDoBotao(documentos)}
      opcoes={documentos.map((d) => ({ valor: chaveDoDocumento(d), rotulo: rotuloDoDocumento(d) }))}
      selecionado={{ valor: chaveDoDocumento(selecionado), rotulo: rotuloDoDocumento(selecionado) }}
      onSelecionar={selecionar}
      onAbrir={() => void abrir()}
      abrindo={abrindo}
      erro={erro}
      linkAlternativo={linkAlternativo}
    />
  );
}
