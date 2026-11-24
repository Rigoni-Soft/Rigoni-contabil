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

export const identidadeDaGuia = ({ parcela, valorCentavos }: GuiaFiscal) =>
  `${parcela}:${valorCentavos ?? ""}`;

export function atribuirGuiasParcelamento(
  guias: GuiaFiscal[],
  parcelamentos: ParcelamentoDoCliente[],
  entregues: GuiaEntregue[] = [],
): GuiaAtribuida[] {
  const recebidas = new Map(parcelamentos.map((p) => [p.id, new Set(p.parcelasEnviadas)]));
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
        p.valorParcelaCentavos === null ||
        valorCentavos === undefined ||
        p.valorParcelaCentavos <= valorCentavos,
    );
    if (candidatos.length === 0) continue;
    if (candidatos.length > 1) continue;
    const dono = candidatos[0];
    if (recebidas.get(dono.id)?.has(parcela)) continue;
    recebidas.get(dono.id)?.add(parcela);
    atribuidas.push({ parcelamento: dono, guia, parcela });
  }
  return atribuidas;
}
