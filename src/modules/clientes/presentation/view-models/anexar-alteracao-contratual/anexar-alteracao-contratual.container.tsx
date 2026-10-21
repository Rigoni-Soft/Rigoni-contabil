"use client";

import { AlteracoesContratuais } from "@/presentation/components/organisms/alteracoes-contratuais.component";
import type { DocumentoContratualVisivelDto } from "@/modules/clientes/application/ports/in/documentos-contratuais-cliente.provider";

import { useDocumentosContratuais } from "../visualizar-documento-contratual/documentos-contratuais.queries";
import { alteracoesDaLista } from "./anexar-alteracao-contratual.presenter";
import { useAnexarAlteracaoContratual } from "./use-anexar-alteracao-contratual.hook";

type Props = { clienteId: string; documentosIniciais?: DocumentoContratualVisivelDto[] };

// Só o Admin recebe este container (a página decide). A lista é a mesma do botão "Visualizar
// alteração": anexar a atualiza pela invalidação da query.
export function AnexarAlteracaoContratualContainer({ clienteId, documentosIniciais }: Props) {
  const { data: documentos = [] } = useDocumentosContratuais(clienteId, documentosIniciais);
  const painelId = `anexar-alteracao-${clienteId}`;
  const formulario = useAnexarAlteracaoContratual(clienteId, documentos, painelId);

  return (
    <AlteracoesContratuais
      painelId={painelId}
      alteracoes={alteracoesDaLista(documentos)}
      {...formulario}
    />
  );
}
