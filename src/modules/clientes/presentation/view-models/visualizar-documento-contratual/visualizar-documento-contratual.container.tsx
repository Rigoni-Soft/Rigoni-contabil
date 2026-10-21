"use client";

import { VisualizarDocumentoContratual } from "@/presentation/components/organisms/visualizar-documento-contratual.component";

import {
  chaveDoDocumento,
  rotuloDoBotao,
  rotuloDoDocumento,
  type DocumentoVisivel,
} from "./documentos-contratuais.presenter";
import { useVisualizarDocumentoContratual } from "./use-visualizar-documento-contratual.hook";

// `documentos` não pode ser vazio: quem renderiza decide pela lista (sem acesso = sem botão).
type Props = { clienteId: string; documentos: DocumentoVisivel[] };

export function VisualizarDocumentoContratualContainer({ clienteId, documentos }: Props) {
  const { selecionado, selecionar, abrir, abrindo, erro } = useVisualizarDocumentoContratual(
    clienteId,
    documentos,
  );

  return (
    <VisualizarDocumentoContratual
      painelId="documentos-contratuais"
      rotuloDoBotao={rotuloDoBotao(documentos)}
      opcoes={documentos.map((d) => ({ chave: chaveDoDocumento(d), rotulo: rotuloDoDocumento(d) }))}
      selecionado={{ chave: chaveDoDocumento(selecionado), rotulo: rotuloDoDocumento(selecionado) }}
      onSelecionar={selecionar}
      onAbrir={() => void abrir()}
      abrindo={abrindo}
      erro={erro}
    />
  );
}
