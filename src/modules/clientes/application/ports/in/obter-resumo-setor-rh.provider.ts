import type {
  CardResumoDto,
  FatiaComparativoDto,
  GrupoResumoDto,
} from "@/modules/clientes/application/ports/in/resumo-setor.provider";

// Mesmo desenho do resumo do SN (cards agrupados + comparativos), com os cards da carteira do RH.
// O comparativo por Responsável só vem para quem vê o acompanhamento dos funcionários (Líder e Admin).
export type ResumoSetorRhDto = {
  totalClientes: number;
  cards: CardResumoDto[];
  grupos: GrupoResumoDto[];
  comparativos: { parcelamento: FatiaComparativoDto[]; responsaveis?: FatiaComparativoDto[] };
};
