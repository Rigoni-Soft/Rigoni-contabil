"use client";

import { AvisoDeStatus } from "@/presentation/components/atoms/aviso-de-status.component";
import { BotaoDeLink } from "@/presentation/components/atoms/botao-de-link.component";
import { Caixa, Linha } from "@/presentation/components/atoms/caixa.component";
import type { DocumentoContratualVisivelDto } from "@/modules/clientes/application/ports/in/documentos-contratuais-cliente.provider";

import { useDocumentosContratuais } from "./documentos-contratuais.queries";
import { VisualizarDocumentoContratualContainer } from "./visualizar-documento-contratual.container";

// Sem acesso (lista vazia): nada na tela. Falha ao consultar: aviso com saída, sem bloquear o form.
type Props = { clienteId: string; documentosIniciais?: DocumentoContratualVisivelDto[] };

export function DocumentoContratualDoClienteContainer({ clienteId, documentosIniciais }: Props) {
  const { data, isPending, isError, refetch } = useDocumentosContratuais(
    clienteId,
    documentosIniciais,
  );
  // Reserva a altura do botão (h-11) enquanto carrega: ele não empurra o formulário ao chegar.
  if (isPending) return <Caixa className="min-h-11" aria-hidden="true" />;
  if (isError) {
    return (
      <Linha alinhar="centro" quebra espaco={2}>
        <AvisoDeStatus
          tipo="erro"
          texto="Não foi possível carregar o contrato social e as alterações."
          className="text-sm"
        />
        <BotaoDeLink onClick={() => void refetch()}>Tentar novamente</BotaoDeLink>
      </Linha>
    );
  }
  if (data.length === 0) return null;
  return <VisualizarDocumentoContratualContainer clienteId={clienteId} documentos={data} />;
}
