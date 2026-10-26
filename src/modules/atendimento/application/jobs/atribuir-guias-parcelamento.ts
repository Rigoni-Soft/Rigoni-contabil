import type { GuiaFiscal } from "@/modules/atendimento/application/ports/out/guias-fiscais.provider";
import type {
  GuiaEntregue,
  ParcelamentoDoCliente,
} from "@/modules/atendimento/application/ports/out/parcelamentos-do-cliente.provider";

export type GuiaAtribuida = {
  parcelamento: ParcelamentoDoCliente;
  guia: GuiaFiscal;
  parcela: string;
};

// Identidade da guia enquanto o provedor não devolve o número do documento: parcela e valor. É o
// que prende a guia entregue ao acordo (cliente_parcelamento_envios.identidade).
export const identidadeDaGuia = ({ parcela, valorCentavos }: GuiaFiscal) =>
  `${parcela}:${valorCentavos ?? ""}`;

// O provedor devolve as guias do CNPJ sem dizer de qual parcelamento é cada uma. Com um só em aberto
// todas vão a ele; com vários, a guia é do de valor guardado mais próximo sem passar do valor dela
// (a atrasada pode vir com juros e multa). Um parcelamento nunca recebe duas da mesma parcela.
//
// A atribuição por valor não prova a quem a guia pertence, então falha fechado. Ficam de fora, sem ir a
// outro parcelamento: a guia sem parcela ou sem candidato; a reemissão de uma guia já entregue (mesma
// identidade em `entregues`, de qualquer acordo do Cliente, inclusive quitado); a de parcela já entregue
// a acordo quitado com outra identidade ou sem identidade (pode ser a reemissão dela, com valor
// corrigido); a de parcela que o dono já recebeu; e a de um grupo de mais de um parcelamento de mesmo
// valor (nada prova de qual é a guia). O chamador alerta o parcelamento que ficou sem guia.
export function atribuirGuiasParcelamento(
  guias: GuiaFiscal[],
  parcelamentos: ParcelamentoDoCliente[],
  entregues: GuiaEntregue[] = [],
): GuiaAtribuida[] {
  const recebidas = new Map(parcelamentos.map((p) => [p.id, new Set(p.parcelasEnviadas)]));
  // Reemissões por identidade: cada entrega anterior consome uma guia igual desta rodada.
  const reemissoes = new Map<string, number>();
  for (const { identidade } of entregues) {
    if (identidade === null) continue;
    reemissoes.set(identidade, (reemissoes.get(identidade) ?? 0) + 1);
  }
  const abertos = new Set(parcelamentos.map((p) => p.id));
  const atribuidas: GuiaAtribuida[] = [];
  for (const guia of guias) {
    const { parcela, valorCentavos } = guia;
    if (!parcela) continue;
    const identidade = identidadeDaGuia(guia);
    const repetidas = reemissoes.get(identidade) ?? 0;
    if (repetidas > 0) {
      reemissoes.set(identidade, repetidas - 1);
      continue;
    }
    const deAcordoQuitado = entregues.some(
      (e) => e.parcela === parcela && !abertos.has(e.parcelamentoId) && e.identidade !== identidade,
    );
    if (deAcordoQuitado) continue;
    const candidatos = parcelamentos.filter(
      (p) =>
        parcelamentos.length === 1 ||
        (p.valorParcelaCentavos !== null &&
          valorCentavos !== undefined &&
          p.valorParcelaCentavos <= valorCentavos),
    );
    if (candidatos.length === 0) continue;
    const maiorValor = Math.max(...candidatos.map((p) => p.valorParcelaCentavos ?? 0));
    const grupo = candidatos.filter((p) => (p.valorParcelaCentavos ?? 0) === maiorValor);
    if (grupo.length > 1) continue;
    const dono = grupo[0];
    if (recebidas.get(dono.id)?.has(parcela)) continue;
    recebidas.get(dono.id)?.add(parcela);
    atribuidas.push({ parcelamento: dono, guia, parcela });
  }
  return atribuidas;
}
