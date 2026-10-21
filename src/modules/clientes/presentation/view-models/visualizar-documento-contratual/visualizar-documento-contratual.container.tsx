"use client";

import { BotaoAnexarAlteracao } from "@/presentation/components/atoms/botao-anexar-alteracao.component";
import { VisualizarDocumentoContratual } from "@/presentation/components/organisms/visualizar-documento-contratual.component";
import type { DocumentoContratualVisivelDto } from "@/modules/clientes/application/ports/in/documentos-contratuais-cliente.provider";

import { rotuloDoDocumento } from "./documentos-contratuais.presenter";
import { useVisualizarDocumentoContratual } from "./use-visualizar-documento-contratual.hook";

// `documentos` não pode ser vazio: quem renderiza decide pela lista (sem acesso = sem cartão).
type VisualizarDocumentoContratualContainerProps = {
  clienteId: string;
  documentos: DocumentoContratualVisivelDto[];
  // Só o Admin: id do diálogo de anexar, aberto pelo botão ao lado de "Abrir em nova aba".
  anexarPainelId?: string;
};

export function VisualizarDocumentoContratualContainer({
  clienteId,
  documentos,
  anexarPainelId,
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
      acaoExtra={anexarPainelId && <BotaoAnexarAlteracao painelId={anexarPainelId} />}
    />
  );
}
