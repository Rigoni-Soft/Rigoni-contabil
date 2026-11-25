"use client";

import { VisualizarDocumentoContratual } from "@/presentation/components/organisms/visualizar-documento-contratual.component";
import type { DocumentoContratualVisivelDto } from "@/modules/clientes/application/ports/in/documentos-contratuais-cliente.provider";

import { idPainelAnexar } from "../anexar-alteracao-contratual/anexar-alteracao-contratual.presenter";
import { rotuloDoDocumento } from "./documentos-contratuais.presenter";
import { useFocoAoDestacar } from "./use-foco-ao-destacar.hook";
import { useVisualizarDocumentoContratual } from "./use-visualizar-documento-contratual.hook";

type VisualizarDocumentoContratualContainerProps = {
  clienteId: string;
  documentos: DocumentoContratualVisivelDto[];
  podeAnexar?: boolean;
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

  const destacar = alteracaoEmFoco !== undefined && documento.numero === alteracaoEmFoco;
  const botaoAbrirRef = useFocoAoDestacar(destacar, `${clienteId}:${documento.numero}`);

  return (
    <VisualizarDocumentoContratual
      rotulo={rotuloDoDocumento(documento)}
      onAbrir={() => void abrir()}
      abrindo={abrindo}
      erro={erro}
      linkAlternativo={linkAlternativo}
      anexarPainelId={podeAnexar ? idPainelAnexar(clienteId) : undefined}
      destacar={destacar}
      botaoAbrirRef={botaoAbrirRef}
    />
  );
}
