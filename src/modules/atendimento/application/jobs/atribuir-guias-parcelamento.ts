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
// identidade em `entregues`, de qualquer acordo do Cliente, inclusive quitado); a de parcela que o dono
// já recebeu; e a de um grupo de mesmo valor em que só alguns já receberam a parcela (não se sabe se é a
// reemissão de um ou a guia de outro). O chamador alerta o parcelamento que ficou sem guia.
export function atribuirGuiasParcelamento(
  guias: GuiaFiscal[],
  parcelamentos: ParcelamentoDoCliente[],
  entregues: GuiaEntregue[] = [],
): GuiaAtribuida[] {
  const jaRecebiam = new Map(parcelamentos.map((p) => [p.id, new Set(p.parcelasEnviadas)]));
  const recebidas = new Map(parcelamentos.map((p) => [p.id, new Set(p.parcelasEnviadas)]));
  // Reemissões por identidade: cada entrega anterior consome uma guia igual desta rodada.
  const reemissoes = new Map<string, number>();
  for (const { identidade } of entregues) {
    reemissoes.set(identidade, (reemissoes.get(identidade) ?? 0) + 1);
  }
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
    const jaTinham = grupo.filter((p) => jaRecebiam.get(p.id)?.has(parcela));
    if (jaTinham.length > 0 && jaTinham.length < grupo.length) continue;
    const dono = grupo.find((p) => !recebidas.get(p.id)?.has(parcela));
    if (!dono) continue;
    recebidas.get(dono.id)?.add(parcela);
    atribuidas.push({ parcelamento: dono, guia, parcela });
  }
  return atribuidas;
}
