import type {
  CardResumoDto,
  FatiaComparativoDto,
  GrupoResumoDto,
} from "@/modules/clientes/application/ports/in/resumo-setor.provider";

// Mesmo desenho do resumo do SN (cards agrupados + comparativos), com os cards da carteira do RH.
// `comparativos` só vem para o Líder: o Funcionário não vê o acompanhamento dos colegas.
export type ResumoSetorRhDto = {
  totalClientes: number;
  cards: CardResumoDto[];
  grupos: GrupoResumoDto[];
  comparativos?: { responsaveis: FatiaComparativoDto[] };
};
