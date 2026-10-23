"use client";

import { BotaoAnexarAlteracao } from "@/presentation/components/atoms/botao-anexar-alteracao.component";
import { Caixa } from "@/presentation/components/atoms/caixa.component";
import { AvisoComAcao } from "@/presentation/components/molecules/aviso-com-acao.component";
import type { DocumentoContratualVisivelDto } from "@/modules/clientes/application/ports/in/documentos-contratuais-cliente.provider";

import { idPainelAnexar } from "../anexar-alteracao-contratual/anexar-alteracao-contratual.presenter";
import { useDocumentosContratuais } from "./documentos-contratuais.queries";
import { VisualizarDocumentoContratualContainer } from "./visualizar-documento-contratual.container";

// Sem acesso (lista vazia): nada na tela. Falha ao consultar: aviso com saída, sem bloquear o form.
type Props = {
  clienteId: string;
  documentosIniciais?: DocumentoContratualVisivelDto[];
  podeAnexar?: boolean;
  // Nº da alteração do aviso por onde se chegou (#144).
  alteracaoEmFoco?: number;
};

export function DocumentoContratualDoClienteContainer({
  clienteId,
  documentosIniciais,
  podeAnexar,
  alteracaoEmFoco,
}: Props) {
  const { data, isPending, confirmando, isError, refetch } = useDocumentosContratuais(
    clienteId,
    documentosIniciais,
    alteracaoEmFoco,
  );
  // Reserva a altura do cartão enquanto carrega (ou confere se a alteração do aviso existe): ele não
  // empurra o formulário ao chegar.
  if (isPending || confirmando) return <Caixa className="min-h-20" aria-hidden="true" />;
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
    return podeAnexar ? <BotaoAnexarAlteracao painelId={idPainelAnexar(clienteId)} /> : null;
  }
  return (
    <VisualizarDocumentoContratualContainer
      clienteId={clienteId}
      documentos={data}
      podeAnexar={podeAnexar}
      alteracaoEmFoco={alteracaoEmFoco}
    />
  );
}
