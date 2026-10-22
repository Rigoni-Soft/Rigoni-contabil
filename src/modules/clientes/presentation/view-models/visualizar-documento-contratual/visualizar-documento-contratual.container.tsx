"use client";

import { VisualizarDocumentoContratual } from "@/presentation/components/organisms/visualizar-documento-contratual.component";
import type { DocumentoContratualVisivelDto } from "@/modules/clientes/application/ports/in/documentos-contratuais-cliente.provider";

import { idPainelAnexar } from "../anexar-alteracao-contratual/anexar-alteracao-contratual.presenter";
import { rotuloDoDocumento } from "./documentos-contratuais.presenter";
import { useVisualizarDocumentoContratual } from "./use-visualizar-documento-contratual.hook";

// `documentos` não pode ser vazio: quem renderiza decide pela lista (sem acesso = sem cartão).
type VisualizarDocumentoContratualContainerProps = {
  clienteId: string;
  documentos: DocumentoContratualVisivelDto[];
  // Só o Admin: botão "Anexar alteração" ao lado de "Abrir em nova aba".
  podeAnexar?: boolean;
  // Nº da alteração do aviso por onde se chegou: abre aquela e destaca o botão (#144).
  alteracaoEmFoco?: number;
};

export function VisualizarDocumentoContratualContainer({
  clienteId,
  documentos,
  podeAnexar,
  alteracaoEmFoco,
}: VisualizarDocumentoContratualContainerProps) {
  const { documento, abrir, abrindo, erro, linkAlternativo } = useVisualizarDocumentoContratual(
    clienteId,
    documentos,
    alteracaoEmFoco,
  );

  return (
    <VisualizarDocumentoContratual
      rotulo={rotuloDoDocumento(documento)}
      onAbrir={() => void abrir()}
      abrindo={abrindo}
      erro={erro}
      linkAlternativo={linkAlternativo}
      anexarPainelId={podeAnexar ? idPainelAnexar(clienteId) : undefined}
      // Só destaca quando o nº do aviso existe: nº desconhecido abre a mais recente, sem anel.
      destacar={alteracaoEmFoco !== undefined && documento.numero === alteracaoEmFoco}
    />
  );
}
