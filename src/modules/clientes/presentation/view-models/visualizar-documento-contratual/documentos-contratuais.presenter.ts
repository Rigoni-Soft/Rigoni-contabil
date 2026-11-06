import type { DocumentoContratualVisivelDto } from "@/modules/clientes/application/ports/in/documentos-contratuais-cliente.provider";
import { formatarDataIso } from "@/shared/kernel/data-iso";

export function rotuloDoDocumento(documento: DocumentoContratualVisivelDto): string {
  if (documento.tipo === "contrato") return "Contrato social";
  const base = `Alteração nº ${documento.numero}`;
  return documento.data ? `${base} - ${formatarDataIso(documento.data)}` : base;
}

// Em destaque: a alteração apontada pelo aviso (`alteracaoEmFoco`, o nº) quando existe na lista; senão
// a de maior nº (o contrato social só quando não há alteração), sem depender da ordem da lista.
export function documentoEmDestaque(
  documentos: DocumentoContratualVisivelDto[],
  alteracaoEmFoco?: number,
): DocumentoContratualVisivelDto {
  const alteracoes = documentos.filter((d) => d.tipo === "alteracao");
  if (alteracoes.length === 0) return documentos[0];
  const apontada = alteracoes.find((d) => d.numero === alteracaoEmFoco);
  if (apontada) return apontada;
  return alteracoes.reduce((maior, d) => ((d.numero ?? 0) > (maior.numero ?? 0) ? d : maior));
}

// `?alteracao=` da URL do aviso: só inteiro positivo conta; qualquer outra coisa (ausente, lista,
// texto) é ignorada em vez de virar erro, e a tela cai no comportamento sem aviso.
export function alteracaoEmFocoDaUrl(valor: string | string[] | undefined): number | undefined {
  return typeof valor === "string" && /^[1-9]\d*$/.test(valor) ? Number(valor) : undefined;
}
