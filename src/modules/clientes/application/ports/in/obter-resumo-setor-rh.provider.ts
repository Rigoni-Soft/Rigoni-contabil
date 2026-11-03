import type {
  CardResumoSnDto,
  FatiaComparativoDto,
  GrupoResumoDto,
} from "@/modules/clientes/application/ports/in/obter-resumo-setor-sn.provider";

// Mesmo desenho do resumo do SN (cards agrupados + comparativos), com os cards da carteira do RH.
// `comparativos` só vem para o Líder: o Funcionário não vê o acompanhamento dos colegas.
export type ResumoSetorRhDto = {
  totalClientes: number;
  cards: CardResumoSnDto[];
  grupos: GrupoResumoDto[];
  comparativos?: { responsaveis: FatiaComparativoDto[] };
};
