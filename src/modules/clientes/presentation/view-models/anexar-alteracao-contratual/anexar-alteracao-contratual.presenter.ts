import type { DocumentoContratualVisivelDto } from "@/modules/clientes/application/ports/in/documentos-contratuais-cliente.provider";
import { formatarDataIso } from "@/shared/kernel/data-iso";
import {
  divergenciaNumeroData,
  erroNumeroRepetidoNoCliente,
} from "@/shared/kernel/numero-alteracao";

type AlteracaoComData = { numero: number; data: string; arquivo: string };

// Só as alterações (o contrato social não tem nº/data), com o que a regra de nº precisa.
function alteracoesComData(documentos: DocumentoContratualVisivelDto[]): AlteracaoComData[] {
  return documentos.flatMap(({ tipo, numero, data, arquivo }) =>
    tipo === "alteracao" && numero !== null && data !== null ? [{ numero, data, arquivo }] : [],
  );
}

// Do maior nº para o menor, sem depender da ordem em que a lista chegou.
export function alteracoesDaLista(documentos: DocumentoContratualVisivelDto[]) {
  return alteracoesComData(documentos)
    .sort((a, b) => b.numero - a.numero)
    .map(({ numero, data, arquivo }) => ({
      numero,
      arquivo,
      rotulo: `Alteração nº ${numero} - ${formatarDataIso(data)}`,
    }));
}

// Checagem pela lista já carregada, antes de subir o arquivo; o banco recusa por 23505 se a lista estiver velha.
export function erroDeNumeroRepetido(
  numero: number,
  documentos: DocumentoContratualVisivelDto[],
): string | null {
  return alteracoesComData(documentos).some((a) => a.numero === numero)
    ? erroNumeroRepetidoNoCliente(numero)
    : null;
}

// Alerta, não bloqueio: data anterior à da alteração de nº menor.
export function avisoDeDivergencia(
  numero: number | undefined,
  data: string,
  documentos: DocumentoContratualVisivelDto[],
): string | null {
  if (!Number.isInteger(numero) || !data) return null;
  const anterior = divergenciaNumeroData(
    { numero: numero as number, data },
    alteracoesComData(documentos),
  );
  return anterior === null ? null : `Data anterior à da alteração nº ${anterior}, confere?`;
}
