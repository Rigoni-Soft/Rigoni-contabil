"use client";

import { BotaoAnexarAlteracao } from "@/presentation/components/atoms/botao-anexar-alteracao.component";
import { Caixa } from "@/presentation/components/atoms/caixa.component";
import { AvisoComAcao } from "@/presentation/components/molecules/aviso-com-acao.component";
import type { DocumentoContratualVisivelDto } from "@/modules/clientes/application/ports/in/documentos-contratuais-cliente.provider";

import { idPainelAnexar } from "../anexar-alteracao-contratual/anexar-alteracao-contratual.presenter";
import { useDocumentosContratuais } from "./documentos-contratuais.queries";
import { VisualizarDocumentoContratualContainer } from "./visualizar-documento-contratual.container";

type Props = {
  clienteId: string;
  documentosIniciais?: DocumentoContratualVisivelDto[];
  podeAnexar?: boolean;
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
