import type {
  CardResumoDto,
  FatiaComparativoDto,
  GrupoResumoDto,
} from "@/modules/clientes/application/ports/in/resumo-setor.provider";

type ComparativosSnDto = {
  das: FatiaComparativoDto[];
  parcelamento: FatiaComparativoDto[];
  atividade: FatiaComparativoDto[];
  responsaveis?: FatiaComparativoDto[];
};

export type ResumoSetorSnDto = {
  totalClientes: number;
  cards: CardResumoDto[];
  grupos: GrupoResumoDto[];
  comparativos: ComparativosSnDto;
};
