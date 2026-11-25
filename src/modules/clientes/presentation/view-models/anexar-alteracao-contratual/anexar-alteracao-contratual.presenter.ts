import type { DocumentoContratualVisivelDto } from "@/modules/clientes/application/ports/in/documentos-contratuais-cliente.provider";
import { formatarDataIso } from "@/shared/kernel/data-iso";
import { divergenciaNumeroData } from "@/shared/kernel/numero-alteracao";

function alteracoesComData(documentos: DocumentoContratualVisivelDto[]) {
  return documentos.flatMap(({ tipo, numero, data, arquivo }) =>
    tipo === "alteracao" && numero !== null && data !== null ? [{ numero, data, arquivo }] : [],
  );
}

export function alteracoesDaLista(documentos: DocumentoContratualVisivelDto[]) {
  return alteracoesComData(documentos)
    .sort((a, b) => b.numero - a.numero)
    .map(({ numero, data, arquivo }) => ({
      numero,
      arquivo,
      rotulo: `Alteração nº ${numero} - ${formatarDataIso(data)}`,
    }));
}

export function avisoDeDivergencia(
  numero: number | undefined,
  data: string,
  documentos: DocumentoContratualVisivelDto[],
): string | undefined {
  if (!Number.isInteger(numero) || !data) return undefined;
  const anterior = divergenciaNumeroData(
    { numero: numero as number, data },
    alteracoesComData(documentos),
  );
  return anterior === null ? undefined : `Data anterior à da alteração nº ${anterior}, confere?`;
}

export const idPainelAnexar = (clienteId: string) => `anexar-alteracao-${clienteId}`;
