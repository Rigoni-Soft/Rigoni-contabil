"use client";

import { Caixa } from "@/presentation/components/atoms/caixa.component";

import { useDocumentosContratuais } from "./documentos-contratuais.queries";
import { VisualizarDocumentoContratualContainer } from "./visualizar-documento-contratual.container";

// Sem acesso, carregando ou com erro: nada na tela (o botão é um acréscimo, nunca bloqueia o form).
export function DocumentoContratualDoClienteContainer({ clienteId }: { clienteId: string }) {
  const { data, isPending } = useDocumentosContratuais(clienteId);
  // Reserva a altura do botão (h-11) enquanto carrega: ele não empurra o formulário ao chegar.
  if (isPending) return <Caixa className="min-h-11" aria-hidden="true" />;
  if (!data || data.length === 0) return null;
  return <VisualizarDocumentoContratualContainer clienteId={clienteId} documentos={data} />;
}
