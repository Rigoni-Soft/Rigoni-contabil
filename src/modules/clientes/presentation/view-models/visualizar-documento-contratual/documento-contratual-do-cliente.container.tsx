"use client";

import { AvisoDeStatus } from "@/presentation/components/atoms/aviso-de-status.component";
import { BotaoDeLink } from "@/presentation/components/atoms/botao-de-link.component";
import { Caixa, Linha } from "@/presentation/components/atoms/caixa.component";

import { useDocumentosContratuais } from "./documentos-contratuais.queries";
import { VisualizarDocumentoContratualContainer } from "./visualizar-documento-contratual.container";

// Sem acesso (lista vazia): nada na tela. Falha ao consultar: aviso com saída, sem bloquear o form.
export function DocumentoContratualDoClienteContainer({ clienteId }: { clienteId: string }) {
  const { data, isPending, isError, refetch } = useDocumentosContratuais(clienteId);
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
  if (!data || data.length === 0) return null;
  return <VisualizarDocumentoContratualContainer clienteId={clienteId} documentos={data} />;
}
