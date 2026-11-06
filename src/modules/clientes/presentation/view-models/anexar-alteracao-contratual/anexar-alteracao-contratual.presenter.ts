import type { DocumentoContratualVisivelDto } from "@/modules/clientes/application/ports/in/documentos-contratuais-cliente.provider";
import { formatarDataIso } from "@/shared/kernel/data-iso";
import { divergenciaNumeroData } from "@/shared/kernel/numero-alteracao";

// Só as alterações (o contrato social não tem nº/data), com o que a regra de nº precisa.
function alteracoesComData(documentos: DocumentoContratualVisivelDto[]) {
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

// Alerta, não bloqueio: data anterior à da alteração de nº menor.
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

// Id do diálogo de anexar: o botão (ao lado de "Abrir em nova aba") e o diálogo (na seção) o compartilham.
export const idPainelAnexar = (clienteId: string) => `anexar-alteracao-${clienteId}`;
