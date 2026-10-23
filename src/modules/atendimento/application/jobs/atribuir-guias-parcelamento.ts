import type { ParcelamentoDoCliente } from "@/modules/atendimento/application/ports/out/parcelamentos-do-cliente.provider";
import type { GuiaFiscal } from "@/modules/atendimento/application/ports/out/guias-fiscais.provider";

// `parcelasEnviadas`: o parcelamento não recebe de novo uma parcela que já tem registro de envio.
type ParcelamentoParaAtribuir = Pick<
  ParcelamentoDoCliente,
  "id" | "valorParcelaCentavos" | "parcelasEnviadas"
>;

export type GuiaAtribuida = { parcelamentoId: string; guia: GuiaFiscal };

// O provedor devolve as guias do CNPJ sem dizer de qual parcelamento é cada uma. Com um só em aberto
// todas vão a ele; com vários, a guia vai ao de valor guardado mais próximo sem passar do valor dela
// (a atrasada pode vir com juros e multa), e um parcelamento nunca recebe duas da mesma parcela.
// Empate de valor é arbitrário (a guia paga do mesmo jeito). Sem candidato a guia fica de fora:
// falha fechado, o chamador alerta em vez de adivinhar.
export function atribuirGuiasParcelamento(
  guias: GuiaFiscal[],
  parcelamentos: ParcelamentoParaAtribuir[],
): { atribuidas: GuiaAtribuida[]; semAtribuicao: GuiaFiscal[] } {
  const usadas = new Map(parcelamentos.map((p) => [p.id, new Set(p.parcelasEnviadas)]));
  const atribuidas: GuiaAtribuida[] = [];
  const semAtribuicao: GuiaFiscal[] = [];
  for (const guia of guias) {
    const livres = parcelamentos.filter((p) => !usadas.get(p.id)?.has(guia.parcela ?? ""));
    const escolhido =
      parcelamentos.length === 1
        ? livres[0]
        : livres
            .filter(
              (p) =>
                p.valorParcelaCentavos !== null &&
                guia.valorCentavos !== undefined &&
                p.valorParcelaCentavos <= guia.valorCentavos,
            )
            .sort((a, b) => (b.valorParcelaCentavos ?? 0) - (a.valorParcelaCentavos ?? 0))[0];
    if (!escolhido || !guia.parcela) {
      semAtribuicao.push(guia);
      continue;
    }
    usadas.get(escolhido.id)?.add(guia.parcela);
    atribuidas.push({ parcelamentoId: escolhido.id, guia });
  }
  return { atribuidas, semAtribuicao };
}
