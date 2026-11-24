import type {
  CardResumoDto,
  FatiaComparativoDto,
  GrupoResumoDto,
} from "@/modules/clientes/application/ports/in/resumo-setor.provider";

export type ResumoSetorRhDto = {
  totalClientes: number;
  cards: CardResumoDto[];
  grupos: GrupoResumoDto[];
  comparativos: { parcelamento: FatiaComparativoDto[]; responsaveis?: FatiaComparativoDto[] };
};
