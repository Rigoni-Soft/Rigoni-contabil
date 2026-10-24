import type { GuiaFiscal } from "@/modules/atendimento/application/ports/out/guias-fiscais.provider";
import type { ParcelamentoDoCliente } from "@/modules/atendimento/application/ports/out/parcelamentos-do-cliente.provider";

export type GuiaAtribuida = {
  parcelamento: ParcelamentoDoCliente;
  guia: GuiaFiscal;
  parcela: string;
};

// O provedor devolve as guias do CNPJ sem dizer de qual parcelamento é cada uma. Com um só em aberto
// todas vão a ele; com vários, a guia é do de valor guardado mais próximo sem passar do valor dela
// (a atrasada pode vir com juros e multa). Empate de valor é arbitrário (a guia paga do mesmo jeito),
// mas um parcelamento nunca recebe duas da mesma parcela.
//
// Fica de fora, sem ir a outro parcelamento: a guia sem parcela ou sem candidato (falha fechado: o
// chamador alerta o parcelamento que ficou sem guia em vez de adivinhar) e a nova emissão de uma
// parcela que o dono já recebeu (o provedor só pula as que todos receberam).
export function atribuirGuiasParcelamento(
  guias: GuiaFiscal[],
  parcelamentos: ParcelamentoDoCliente[],
): GuiaAtribuida[] {
  const recebidas = new Map(parcelamentos.map((p) => [p.id, new Set(p.parcelasEnviadas)]));
  const atribuidas: GuiaAtribuida[] = [];
  for (const guia of guias) {
    const { parcela, valorCentavos } = guia;
    if (!parcela) continue;
    const candidatos = parcelamentos.filter(
      (p) =>
        parcelamentos.length === 1 ||
        (p.valorParcelaCentavos !== null &&
          valorCentavos !== undefined &&
          p.valorParcelaCentavos <= valorCentavos),
    );
    if (candidatos.length === 0) continue;
    const maiorValor = Math.max(...candidatos.map((p) => p.valorParcelaCentavos ?? 0));
    const dono = candidatos.find(
      (p) => (p.valorParcelaCentavos ?? 0) === maiorValor && !recebidas.get(p.id)?.has(parcela),
    );
    if (!dono) continue;
    recebidas.get(dono.id)?.add(parcela);
    atribuidas.push({ parcelamento: dono, guia, parcela });
  }
  return atribuidas;
}
