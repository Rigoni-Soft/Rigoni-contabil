"use client";

import { BotaoAnexarAlteracao } from "@/presentation/components/atoms/botao-anexar-alteracao.component";
import { Caixa } from "@/presentation/components/atoms/caixa.component";
import { AvisoComAcao } from "@/presentation/components/molecules/aviso-com-acao.component";
import type { DocumentoContratualVisivelDto } from "@/modules/clientes/application/ports/in/documentos-contratuais-cliente.provider";

import { useDocumentosContratuais } from "./documentos-contratuais.queries";
import { VisualizarDocumentoContratualContainer } from "./visualizar-documento-contratual.container";

// Sem acesso (lista vazia): nada na tela. Falha ao consultar: aviso com saída, sem bloquear o form.
type Props = {
  clienteId: string;
  documentosIniciais?: DocumentoContratualVisivelDto[];
  anexarPainelId?: string;
};

export function DocumentoContratualDoClienteContainer({
  clienteId,
  documentosIniciais,
  anexarPainelId,
}: Props) {
  const { data, isPending, isError, refetch } = useDocumentosContratuais(
    clienteId,
    documentosIniciais,
  );
  // Reserva a altura do cartão enquanto carrega: ele não empurra o formulário ao chegar.
  if (isPending) return <Caixa className="min-h-20" aria-hidden="true" />;
  if (isError) {
    return (
      <AvisoComAcao
        texto="Não foi possível carregar o contrato social e as alterações."
        rotuloDaAcao="Tentar novamente"
        onAcao={() => void refetch()}
      />
    );
  }
  // Sem nada a abrir, o Admin ainda precisa de como anexar a primeira alteração.
  if (data.length === 0) {
    return anexarPainelId ? <BotaoAnexarAlteracao painelId={anexarPainelId} /> : null;
  }
  return (
    <VisualizarDocumentoContratualContainer
      clienteId={clienteId}
      documentos={data}
      anexarPainelId={anexarPainelId}
    />
  );
}
